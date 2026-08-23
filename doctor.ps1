# Thin forwarder. The doctor ships inside the plugin payload
# (plugins\claude-kit\doctor\doctor.ps1) so installed machines get it with
# every plugin update; this wrapper keeps the repo-root habit working.
# Usage: .\doctor.ps1 [-Fix] [-Yes]
$target = Join-Path $PSScriptRoot "plugins\claude-kit\doctor\doctor.ps1"
if (-not (Test-Path $target)) {
    Write-Host "Payload doctor not found at $target (partial checkout or moved file)." -ForegroundColor Red
    exit 1
}
& $target @args
# A binding failure in the payload is statement-terminating, so the payload
# body never runs and never sets $LASTEXITCODE. A bare `exit $LASTEXITCODE`
# would then exit 0 and report a clean run having executed no check at all.
if ($null -eq $LASTEXITCODE) { exit 1 }
exit $LASTEXITCODE
