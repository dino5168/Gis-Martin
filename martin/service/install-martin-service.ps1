#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs (or reinstalls) Martin as the Windows service "MartinTiles" using WinSW.

.DESCRIPTION
    - Binaries go to C:\Program Files\MartinTiles (admin-only write), so a
      non-admin user cannot swap the executable that the service runs.
    - Runs as NT AUTHORITY\LocalService (least privilege, no password).
    - Depends on postgresql-x64-17 and restarts automatically on failure.
    - MARTIN_DB_URL (contains the martin_reader password) is written into the
      WinSW XML, whose ACL is limited to SYSTEM, Administrators and LocalService.
    - config.yaml stays in C:\gis\osm\martin so it can be edited without admin;
      restart the service after editing.

    This file is intentionally ASCII-only: Windows PowerShell 5.1 reads BOM-less
    scripts using the ANSI code page (cp950), which would corrupt non-ASCII text.

.PARAMETER WinSWPath
    Path to the downloaded WinSW.NET461.exe (v2.12.0).

.PARAMETER EnvFile
    The project .env holding MARTIN_USER / MARTIN_PASSWORD / PGHOST / PGPORT / OSM_DB.

.PARAMETER ConfigPath
    Martin config.yaml used by the service.

.PARAMETER LogFile
    Transcript of this installer (useful because the elevated window closes).
#>
param(
    [Parameter(Mandatory = $true)][string]$WinSWPath,
    [string]$EnvFile = 'C:\gis\osm\.env',
    [string]$ConfigPath = 'C:\gis\osm\martin\config.yaml',
    [string]$MartinExe = 'C:\Tools\martin\martin.exe',
    [string]$LogFile = 'C:\ProgramData\MartinTiles\install.log'
)

$ErrorActionPreference = 'Stop'
$ServiceId = 'MartinTiles'
$InstallDir = 'C:\Program Files\MartinTiles'
$DataDir = 'C:\ProgramData\MartinTiles'
$LogDir = Join-Path $DataDir 'logs'
$ServiceAccount = 'NT AUTHORITY\LocalService'
# Well-known SIDs avoid localized account names (e.g. on zh-TW Windows).
$SidLocalService = '*S-1-5-19'
$SidSystem = '*S-1-5-18'
$SidAdmins = '*S-1-5-32-544'

New-Item -ItemType Directory -Force $DataDir, $LogDir | Out-Null
Start-Transcript -Path $LogFile -Force | Out-Null

function Invoke-Native {
    <#
    .SYNOPSIS
        Runs a native command and throws on a non-zero exit code.
    .PARAMETER File
        Executable path.
    .PARAMETER Arguments
        Argument list.
    #>
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') failed with exit code $LASTEXITCODE" }
}

try {
    foreach ($p in $WinSWPath, $EnvFile, $ConfigPath, $MartinExe) {
        if (-not (Test-Path $p)) { throw "Required file not found: $p" }
    }

    # --- Read connection settings from .env (values are never printed) ---
    $cfg = @{}
    Get-Content $EnvFile -Encoding UTF8 | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
        $k, $v = $_ -split '=', 2
        $cfg[$k.Trim()] = $v.Trim()
    }
    foreach ($k in 'MARTIN_USER', 'MARTIN_PASSWORD', 'PGHOST', 'PGPORT', 'OSM_DB') {
        if (-not $cfg[$k]) { throw "$k is missing in $EnvFile" }
    }
    $dbUrl = 'postgresql://{0}:{1}@{2}:{3}/{4}' -f `
        [uri]::EscapeDataString($cfg.MARTIN_USER), [uri]::EscapeDataString($cfg.MARTIN_PASSWORD),
        $cfg.PGHOST, $cfg.PGPORT, $cfg.OSM_DB

    # --- Remove an existing installation (idempotent reinstall) ---
    $svcExe = Join-Path $InstallDir "$ServiceId.exe"
    if (Get-Service $ServiceId -ErrorAction SilentlyContinue) {
        Write-Output "Existing service found; stopping and uninstalling."
        Stop-Service $ServiceId -Force -ErrorAction SilentlyContinue
        if (Test-Path $svcExe) { Invoke-Native $svcExe @('uninstall') }
        else { Invoke-Native 'sc.exe' @('delete', $ServiceId) }
        Start-Sleep -Seconds 2
    }

    # --- Copy binaries into the admin-only directory ---
    New-Item -ItemType Directory -Force $InstallDir | Out-Null
    Copy-Item $WinSWPath $svcExe -Force
    Copy-Item $MartinExe (Join-Path $InstallDir 'martin.exe') -Force

    # --- WinSW XML ---
    $esc = { param($s) [Security.SecurityElement]::Escape($s) }
    $xml = @"
<service>
  <id>$ServiceId</id>
  <name>Martin Vector Tiles (Taiwan OSM)</name>
  <description>Martin MVT tile server for the osm_taiwan PostGIS database. Config: $(& $esc $ConfigPath)</description>
  <executable>$(& $esc (Join-Path $InstallDir 'martin.exe'))</executable>
  <arguments>--config "$(& $esc $ConfigPath)"</arguments>
  <env name="MARTIN_DB_URL" value="$(& $esc $dbUrl)" />
  <!-- Martin emits ANSI colour codes even when stdout is redirected; keep log files plain text. -->
  <env name="NO_COLOR" value="1" />
  <depend>postgresql-x64-17</depend>
  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="10 sec" />
  <onfailure action="restart" delay="30 sec" />
  <onfailure action="restart" delay="60 sec" />
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>15 sec</stoptimeout>
  <logpath>$(& $esc $LogDir)</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>
</service>
"@
    $xmlPath = Join-Path $InstallDir "$ServiceId.xml"
    [IO.File]::WriteAllText($xmlPath, $xml, (New-Object Text.UTF8Encoding $false))

    # --- ACLs ---
    # XML holds the DB password: no inheritance; SYSTEM/Admins full, LocalService read-only.
    Invoke-Native 'icacls.exe' @($xmlPath, '/inheritance:r', '/grant:r', "${SidSystem}:(F)", "${SidAdmins}:(F)", "${SidLocalService}:(R)")
    # Logs: LocalService must be able to write.
    Invoke-Native 'icacls.exe' @($LogDir, '/grant', "${SidLocalService}:(OI)(CI)(M)")
    # config.yaml lives in a user folder; make sure LocalService can read it.
    Invoke-Native 'icacls.exe' @($ConfigPath, '/grant', "${SidLocalService}:(R)")

    # --- Install, switch account, start ---
    Invoke-Native $svcExe @('install')
    # Built-in accounts need no password; PS 5.1 would also drop an empty '' argument.
    Invoke-Native 'sc.exe' @('config', $ServiceId, 'obj=', $ServiceAccount)
    Invoke-Native 'sc.exe' @('description', $ServiceId, 'Martin MVT tile server (osm_taiwan). Managed by WinSW.')
    Start-Service $ServiceId

    # --- Wait for the health endpoint ---
    $deadline = (Get-Date).AddSeconds(30)
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $null = Invoke-WebRequest 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 2
            $healthy = $true
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    $svc = Get-CimInstance Win32_Service -Filter "Name='$ServiceId'"
    Write-Output ("RESULT service={0} state={1} startmode={2} account={3} healthy={4}" -f `
        $svc.Name, $svc.State, $svc.StartMode, $svc.StartName, $healthy)
    if (-not $healthy) { throw "Service started but /health did not respond within 30 s; see $LogDir" }
}
catch {
    Write-Output "INSTALL FAILED: $($_.Exception.Message)"
    exit 1
}
finally {
    Stop-Transcript | Out-Null
}
