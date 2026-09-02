[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ExportDirectory,
    [Parameter(Mandatory = $true)][string]$ProjectRef,
    [Parameter(Mandatory = $true)][string]$ConfirmedProjectRef,
    [Parameter(Mandatory = $true)][string]$DatabaseHost,
    [Parameter(Mandatory = $true)][string]$DatabaseUser,
    [int]$DatabasePort = 5432,
    [string]$DatabaseName = 'postgres'
)

$ErrorActionPreference = 'Stop'
$migrationOldProjectRef = 'vbdtdihxmapezhkfmugi'
$migrationContainer = 'supabase_db_Plataforma_Marketing'
$migrationRepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$migrationVerificationSql = Join-Path $PSScriptRoot 'target-verification.sql'

if ($ProjectRef -notmatch '^[a-z0-9]{20}$') { throw 'ProjectRef must be the 20-character reference from the new Supabase project.' }
if ($ProjectRef -ne $ConfirmedProjectRef) { throw 'Project reference confirmation does not match.' }
if ($ProjectRef -eq $migrationOldProjectRef) { throw 'The previous hosted Supabase project is never a valid restore target.' }

$migrationDirectHost = $DatabaseHost -eq "db.$ProjectRef.supabase.co"
$migrationPoolerTarget = $DatabaseHost -match '\.pooler\.supabase\.com$' -and $DatabaseUser -eq "postgres.$ProjectRef"
if (-not ($migrationDirectHost -or $migrationPoolerTarget)) {
    throw 'Database host/user do not identify the confirmed new Supabase project.'
}

$migrationExportPath = (Resolve-Path -LiteralPath $ExportDirectory).Path
$migrationPrivateRoot = (Resolve-Path -LiteralPath (Join-Path $migrationRepositoryRoot '.migration-private')).Path
if (-not $migrationExportPath.StartsWith($migrationPrivateRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'ExportDirectory must be inside the private migration workspace.'
}

$migrationRequiredFiles = @(
    'roles.sql', 'schema.sql', 'data.sql', 'history_schema.sql',
    'history_data.sql', 'source-inventory.txt', 'SHA256SUMS.txt'
)
foreach ($migrationRequiredFile in $migrationRequiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $migrationExportPath $migrationRequiredFile) -PathType Leaf)) {
        throw "Missing migration artifact: $migrationRequiredFile"
    }
}

$migrationExpectedHashes = @{}
foreach ($migrationHashLine in Get-Content -LiteralPath (Join-Path $migrationExportPath 'SHA256SUMS.txt')) {
    if ($migrationHashLine -notmatch '^([0-9a-fA-F]{64}) \*(.+)$') { throw 'Invalid SHA256SUMS.txt format.' }
    $migrationExpectedHashes[$Matches[2]] = $Matches[1].ToLowerInvariant()
}
foreach ($migrationArtifactName in $migrationRequiredFiles | Where-Object { $_ -ne 'SHA256SUMS.txt' }) {
    $migrationActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $migrationExportPath $migrationArtifactName)).Hash.ToLowerInvariant()
    if ($migrationExpectedHashes[$migrationArtifactName] -ne $migrationActualHash) {
        throw "Migration artifact hash mismatch: $migrationArtifactName"
    }
}

$migrationDockerState = docker inspect -f '{{.State.Health.Status}}' $migrationContainer
if ($LASTEXITCODE -ne 0 -or $migrationDockerState.Trim() -ne 'healthy') {
    throw 'The PostgreSQL 17 client container is not healthy.'
}

$migrationSecurePassword = Read-Host 'New Supabase database password' -AsSecureString
$migrationPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($migrationSecurePassword)
$migrationPlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($migrationPasswordPointer)
$migrationRunId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$migrationContainerDirectory = "/tmp/one-studios-migration-$migrationRunId"

function Invoke-TargetPsql {
    param(
        [Parameter(Mandatory = $true)][string[]]$PsqlArguments,
        [switch]$Capture
    )
    $migrationDockerArguments = @(
        'exec', '-e', "PGPASSWORD=$migrationPlainPassword", $migrationContainer,
        'psql', '-X', '-h', $DatabaseHost, '-p', [string]$DatabasePort,
        '-U', $DatabaseUser, '-d', $DatabaseName
    ) + $PsqlArguments
    $migrationResult = & docker @migrationDockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Target PostgreSQL command failed: $($PsqlArguments -join ' ')" }
    if ($Capture) { return [string[]]$migrationResult }
}

try {
    $migrationPreflightSql = @"
select current_setting('server_version_num')::int / 10000,
       (select count(*) from auth.users),
       (select count(*) from information_schema.tables where table_schema='marketing_app');
"@
    $migrationPreflight = (Invoke-TargetPsql -Capture -PsqlArguments @('-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', $migrationPreflightSql) | Select-Object -Last 1).Trim()
    if ($migrationPreflight -notmatch '^17\|0\|0$') {
        throw "Restore target is not an empty PostgreSQL 17 Supabase project: $migrationPreflight"
    }

    docker exec $migrationContainer mkdir -p $migrationContainerDirectory | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the temporary restore directory.' }

    foreach ($migrationCopyName in @('roles.sql', 'schema.sql', 'data.sql', 'history_schema.sql', 'history_data.sql')) {
        docker cp (Join-Path $migrationExportPath $migrationCopyName) "${migrationContainer}:$migrationContainerDirectory/$migrationCopyName" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not stage $migrationCopyName for restore." }
    }
    docker cp $migrationVerificationSql "${migrationContainer}:$migrationContainerDirectory/target-verification.sql" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage target-verification.sql.' }

    Invoke-TargetPsql -PsqlArguments @(
        '--single-transaction', '--variable', 'ON_ERROR_STOP=1',
        '--file', "$migrationContainerDirectory/roles.sql",
        '--file', "$migrationContainerDirectory/schema.sql",
        '--command', 'SET session_replication_role = replica',
        '--file', "$migrationContainerDirectory/data.sql"
    )

    $migrationHistoryState = (Invoke-TargetPsql -Capture -PsqlArguments @(
        '-At', '-v', 'ON_ERROR_STOP=1', '-c',
        "select case when to_regclass('supabase_migrations.schema_migrations') is null then 'missing' else (select count(*)::text from supabase_migrations.schema_migrations) end"
    ) | Select-Object -Last 1).Trim()
    if ($migrationHistoryState -eq 'missing') {
        Invoke-TargetPsql -PsqlArguments @(
            '--single-transaction', '--variable', 'ON_ERROR_STOP=1',
            '--file', "$migrationContainerDirectory/history_schema.sql",
            '--file', "$migrationContainerDirectory/history_data.sql"
        )
    } elseif ($migrationHistoryState -eq '0') {
        Invoke-TargetPsql -PsqlArguments @(
            '--single-transaction', '--variable', 'ON_ERROR_STOP=1',
            '--file', "$migrationContainerDirectory/history_data.sql"
        )
    } elseif ($migrationHistoryState -ne '16') {
        throw "Unexpected migration history state after restore: $migrationHistoryState"
    }

    Invoke-TargetPsql -PsqlArguments @(
        '--single-transaction', '--variable', 'ON_ERROR_STOP=1', '-c',
        'truncate table auth.refresh_tokens, auth.sessions, auth.mfa_amr_claims, auth.mfa_challenges, auth.flow_state, auth.one_time_tokens restart identity cascade;'
    )

    $migrationTargetInventory = Invoke-TargetPsql -Capture -PsqlArguments @(
        '-v', 'ON_ERROR_STOP=1', '--file', "$migrationContainerDirectory/target-verification.sql"
    )
    [System.IO.File]::WriteAllLines(
        (Join-Path $migrationExportPath 'target-verification.txt'),
        [string[]]$migrationTargetInventory,
        [System.Text.UTF8Encoding]::new($false)
    )

    $migrationCountsSql = @"
select (select count(*) from auth.users),
       (select count(*) from auth.identities),
       (select count(*) from marketing_app.members),
       (select count(*) from marketing_app.clients),
       (select count(*) from marketing_app.treasury_contracts),
       (select count(*) from marketing_app.treasury_installments),
       (select count(*) from marketing_app.treasury_movements),
       (select count(*) from marketing_app.roles),
       (select count(*) from marketing_app.role_permissions),
       (select count(*) from storage.buckets),
       (select count(*) from storage.objects),
       (select count(*) from supabase_migrations.schema_migrations);
"@
    $migrationCounts = (Invoke-TargetPsql -Capture -PsqlArguments @('-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', $migrationCountsSql) | Select-Object -Last 1).Trim()
    $migrationExpectedCounts = '3|3|3|1|2|4|11|5|247|3|0|16'
    if ($migrationCounts -ne $migrationExpectedCounts) {
        throw "Target parity mismatch. Expected $migrationExpectedCounts; received $migrationCounts"
    }

    $migrationSignatureSql = @"
select md5(coalesce(string_agg(schemaname||'|'||tablename||'|'||policyname||'|'||cmd, E'\n' order by schemaname,tablename,policyname,cmd),''))
from pg_policies where schemaname in ('marketing_app','public','storage');
select md5(coalesce(string_agg(n.nspname||'|'||p.proname||'|'||pg_get_function_identity_arguments(p.oid)||'|'||pg_get_functiondef(p.oid), E'\n' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),''))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('marketing_app','public');
"@
    $migrationSourceSignatures = docker exec $migrationContainer psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -c $migrationSignatureSql
    if ($LASTEXITCODE -ne 0) { throw 'Source policy/function signature query failed.' }
    $migrationTargetSignatures = Invoke-TargetPsql -Capture -PsqlArguments @('-At', '-v', 'ON_ERROR_STOP=1', '-c', $migrationSignatureSql)
    if (($migrationSourceSignatures -join '|') -ne ($migrationTargetSignatures -join '|')) {
        throw 'Target policy/function signatures do not match the Docker source.'
    }

    $migrationParityLines = @(
        'status=PASS',
        "project_ref=$ProjectRef",
        'auth_users=3',
        'auth_identities=3',
        'members=3',
        'clients=1',
        'contracts=2',
        'installments=4',
        'movements=11',
        'roles=5',
        'role_permissions=247',
        'storage_buckets=3',
        'storage_objects=0',
        'migration_versions=16',
        'policy_function_signatures=matched'
    )
    [System.IO.File]::WriteAllLines(
        (Join-Path $migrationExportPath 'parity-report.txt'),
        $migrationParityLines,
        [System.Text.UTF8Encoding]::new($false)
    )
    Write-Host "Hosted Supabase restore verified for project $ProjectRef."
    Write-Host "Parity report: $(Join-Path $migrationExportPath 'parity-report.txt')"
} finally {
    $migrationPlainPassword = $null
    if ($migrationPasswordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($migrationPasswordPointer)
    }
}
