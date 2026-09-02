function Convert-MigrationRolesForHostedSupabase {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    $migrationManagedGrant = 'GRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";'
    $migrationSourceLines = [System.IO.File]::ReadAllLines($SourcePath)
    $migrationManagedGrantCount = @($migrationSourceLines | Where-Object { $_ -eq $migrationManagedGrant }).Count
    if ($migrationManagedGrantCount -ne 1) {
        throw "Expected exactly one managed Supabase parameter grant; found $migrationManagedGrantCount."
    }

    $migrationHostedLines = [string[]]@($migrationSourceLines | Where-Object { $_ -ne $migrationManagedGrant })
    [System.IO.File]::WriteAllLines(
        $DestinationPath,
        $migrationHostedLines,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Convert-MigrationDataForHostedSupabase {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    $migrationPortableManagedTables = @{
        'auth.users' = 0
        'auth.identities' = 0
        'storage.buckets' = 0
        'storage.objects' = 0
    }
    $migrationKnownSchemas = @('auth', 'marketing_app', 'public', 'storage', 'supabase_functions')

    $migrationSourceLines = [System.IO.File]::ReadAllLines($SourcePath)
    $migrationHostedLines = [System.Collections.Generic.List[string]]::new()
    for ($migrationLineIndex = 0; $migrationLineIndex -lt $migrationSourceLines.Count; $migrationLineIndex++) {
        $migrationCurrentLine = $migrationSourceLines[$migrationLineIndex]
        if ($migrationCurrentLine -match '^COPY "([^"]+)"\."([^"]+)" ') {
            $migrationCopySchema = $Matches[1]
            $migrationCopyTable = $Matches[2]
            if ($migrationKnownSchemas -notcontains $migrationCopySchema) {
                throw "Unexpected schema in migration data: $migrationCopySchema"
            }
            $migrationCopyKey = "$migrationCopySchema.$migrationCopyTable"
            $migrationKeepCopy = $migrationCopySchema -in @('marketing_app', 'public') -or $migrationPortableManagedTables.ContainsKey($migrationCopyKey)
            if ($migrationPortableManagedTables.ContainsKey($migrationCopyKey)) {
                $migrationPortableManagedTables[$migrationCopyKey]++
            }
            if ($migrationKeepCopy) {
                $migrationHostedLines.Add($migrationCurrentLine)
                continue
            }

            while ($migrationLineIndex + 1 -lt $migrationSourceLines.Count) {
                $migrationLineIndex++
                if ($migrationSourceLines[$migrationLineIndex] -eq '\.') { break }
            }
            if ($migrationSourceLines[$migrationLineIndex] -ne '\.') {
                throw "Unterminated COPY block for non-portable managed table: $migrationCopyKey"
            }
            continue
        }
        if ($migrationCurrentLine.StartsWith('COPY ', [System.StringComparison]::Ordinal)) {
            throw "Unrecognized COPY statement in migration data: $migrationCurrentLine"
        }
        if ($migrationCurrentLine.StartsWith('SELECT pg_catalog.setval(', [System.StringComparison]::Ordinal) -and
            -not ($migrationCurrentLine.Contains('"marketing_app".') -or $migrationCurrentLine.Contains('"public".'))) {
            continue
        }
        else {
            $migrationHostedLines.Add($migrationCurrentLine)
        }
    }

    foreach ($migrationPortableManagedTable in @($migrationPortableManagedTables.Keys)) {
        if ($migrationPortableManagedTables[$migrationPortableManagedTable] -ne 1) {
            throw "Expected exactly one COPY block for $migrationPortableManagedTable; found $($migrationPortableManagedTables[$migrationPortableManagedTable])."
        }
    }
    [System.IO.File]::WriteAllLines(
        $DestinationPath,
        [string[]]$migrationHostedLines,
        [System.Text.UTF8Encoding]::new($false)
    )
}
