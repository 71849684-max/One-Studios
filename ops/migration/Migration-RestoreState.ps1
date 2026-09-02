function Resolve-MigrationRestoreMode {
    param(
        [Parameter(Mandatory = $true)][string]$PreflightState
    )

    switch ($PreflightState) {
        '17|0|0|0|t' { return 'fresh' }
        '17|3|3|59|t' { return 'resume-history' }
        '17|3|3|59|f' { return 'resume-verification' }
        default { throw "Restore target is neither empty nor the exact verified resume checkpoint: $PreflightState" }
    }
}
