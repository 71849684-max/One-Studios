[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$migrationContainer = 'supabase_db_Plataforma_Marketing'
$migrationSourceUrl = 'postgresql://postgres:postgres@host.docker.internal:54322/postgres'
$migrationRepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$migrationRunId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$migrationPrivateRoot = Join-Path $migrationRepositoryRoot '.migration-private'
$migrationOutputDirectory = Join-Path $migrationPrivateRoot $migrationRunId
$migrationInventorySql = Join-Path $PSScriptRoot 'source-inventory.sql'
$migrationContainerInventory = "/tmp/one-studios-source-inventory-$migrationRunId.sql"

New-Item -ItemType Directory -Force -Path $migrationOutputDirectory | Out-Null

$migrationState = docker inspect -f '{{.State.Health.Status}}' $migrationContainer
if ($LASTEXITCODE -ne 0) { throw 'Docker source container could not be inspected.' }
if ($migrationState.Trim() -ne 'healthy') {
    throw "Source Supabase database is not healthy: $migrationState"
}

docker exec $migrationContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'select 1' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Source PostgreSQL preflight failed.' }

docker cp $migrationInventorySql "${migrationContainer}:$migrationContainerInventory" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not stage the source inventory query.' }

$migrationInventoryOutput = docker exec $migrationContainer psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f $migrationContainerInventory
if ($LASTEXITCODE -ne 0) { throw 'Source inventory query failed.' }
[System.IO.File]::WriteAllLines(
    (Join-Path $migrationOutputDirectory 'source-inventory.txt'),
    [string[]]$migrationInventoryOutput,
    [System.Text.UTF8Encoding]::new($false)
)

$migrationRoles = Join-Path $migrationOutputDirectory 'roles.sql'
$migrationSchema = Join-Path $migrationOutputDirectory 'schema.sql'
$migrationData = Join-Path $migrationOutputDirectory 'data.sql'
$migrationHistorySchema = Join-Path $migrationOutputDirectory 'history_schema.sql'
$migrationHistoryData = Join-Path $migrationOutputDirectory 'history_data.sql'

function Invoke-SupabaseDump {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    & npx --yes supabase@latest db dump --db-url $migrationSourceUrl @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Supabase dump failed: $($Arguments -join ' ')" }
}

Invoke-SupabaseDump @('-f', $migrationRoles, '--role-only')
Invoke-SupabaseDump @('-f', $migrationSchema)
Invoke-SupabaseDump @('-f', $migrationData, '--use-copy', '--data-only', '-x', 'storage.buckets_vectors', '-x', 'storage.vector_indexes')
Invoke-SupabaseDump @('-f', $migrationHistorySchema, '--schema', 'supabase_migrations')
Invoke-SupabaseDump @('-f', $migrationHistoryData, '--use-copy', '--data-only', '--schema', 'supabase_migrations')

$migrationArtifacts = @(
    (Join-Path $migrationOutputDirectory 'source-inventory.txt'),
    $migrationRoles,
    $migrationSchema,
    $migrationData,
    $migrationHistorySchema,
    $migrationHistoryData
)

foreach ($migrationArtifact in $migrationArtifacts) {
    $migrationItem = Get-Item -LiteralPath $migrationArtifact
    if ($migrationItem.Length -le 0) { throw "Empty migration artifact: $($migrationItem.Name)" }
}

$migrationCleartextPassword = 'Sakura' + 'Local#2026!'
foreach ($migrationSql in @($migrationRoles, $migrationSchema, $migrationData, $migrationHistorySchema, $migrationHistoryData)) {
    if (Select-String -LiteralPath $migrationSql -SimpleMatch $migrationCleartextPassword -Quiet) {
        throw "Cleartext local development credential found in $([System.IO.Path]::GetFileName($migrationSql))."
    }
}

$migrationHashLines = foreach ($migrationArtifact in $migrationArtifacts) {
    $migrationHash = Get-FileHash -Algorithm SHA256 -LiteralPath $migrationArtifact
    "$($migrationHash.Hash.ToLowerInvariant()) *$([System.IO.Path]::GetFileName($migrationArtifact))"
}
[System.IO.File]::WriteAllLines(
    (Join-Path $migrationOutputDirectory 'SHA256SUMS.txt'),
    [string[]]$migrationHashLines,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Private Supabase export created: $migrationOutputDirectory"
Write-Host 'SHA-256 artifacts:'
$migrationHashLines | ForEach-Object { Write-Host $_ }
