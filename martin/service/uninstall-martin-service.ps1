#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Stops and removes the "MartinTiles" Windows service and its installed files.

.DESCRIPTION
    Removes C:\Program Files\MartinTiles (binaries + XML with the DB password).
    Logs in C:\ProgramData\MartinTiles are kept unless -RemoveLogs is given.
    ASCII-only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).

.PARAMETER RemoveLogs
    Also delete C:\ProgramData\MartinTiles.
#>
param([switch]$RemoveLogs)

$ErrorActionPreference = 'Stop'
$ServiceId = 'MartinTiles'
$InstallDir = 'C:\Program Files\MartinTiles'
$DataDir = 'C:\ProgramData\MartinTiles'

if (Get-Service $ServiceId -ErrorAction SilentlyContinue) {
    Stop-Service $ServiceId -Force -ErrorAction SilentlyContinue
    $svcExe = Join-Path $InstallDir "$ServiceId.exe"
    if (Test-Path $svcExe) { & $svcExe uninstall } else { sc.exe delete $ServiceId }
    if ($LASTEXITCODE -ne 0) { throw "Failed to remove service $ServiceId (exit $LASTEXITCODE)" }
    Write-Output "Service $ServiceId removed."
} else {
    Write-Output "Service $ServiceId not installed."
}

Start-Sleep -Seconds 2
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force; Write-Output "Removed $InstallDir" }
if ($RemoveLogs -and (Test-Path $DataDir)) { Remove-Item $DataDir -Recurse -Force; Write-Output "Removed $DataDir" }
