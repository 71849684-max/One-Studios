function Get-MigrationSha256Hex {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath
    )

    $migrationHashStream = [System.IO.File]::OpenRead($LiteralPath)
    $migrationHashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $migrationHashBytes = $migrationHashAlgorithm.ComputeHash($migrationHashStream)
        return ([System.BitConverter]::ToString($migrationHashBytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $migrationHashAlgorithm.Dispose()
        $migrationHashStream.Dispose()
    }
}
