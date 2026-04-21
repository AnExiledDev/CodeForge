param(
    [int]$ChromePort = 9222,
    [int]$ProxyPort = 9223,
    [string]$ProfileDir = "$env:TEMP\chrome-cdp-hermes",
    [string]$ChromePath,
    [switch]$Cleanup,
    [switch]$RemoveProfile
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Administrator {
    if (-not (Test-IsAdministrator)) {
        Write-Error "Run PowerShell as Administrator, then rerun this script."
    }
}

function Resolve-ChromePath {
    param([string]$OverridePath)

    if ($OverridePath) {
        if (Test-Path -LiteralPath $OverridePath) {
            return (Resolve-Path -LiteralPath $OverridePath).Path
        }

        Write-Error "ChromePath does not exist: $OverridePath"
    }

    $candidates = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    Write-Error "Chrome was not found. Pass -ChromePath with the full path to chrome.exe."
}

function Test-CdpEndpoint {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        $json = $response.Content | ConvertFrom-Json
        return [bool]($json.Browser -and $json.webSocketDebuggerUrl)
    }
    catch {
        return $false
    }
}

function Wait-CdpEndpoint {
    param(
        [string]$Url,
        [int]$Attempts = 20,
        [int]$DelayMilliseconds = 500
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        if (Test-CdpEndpoint -Url $Url) {
            return $true
        }

        Start-Sleep -Milliseconds $DelayMilliseconds
    }

    return $false
}

function Remove-PortProxy {
    param([int]$ListenPort)

    & netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort | Out-Null
}

function Add-PortProxy {
    param(
        [int]$ListenPort,
        [int]$ConnectPort
    )

    Remove-PortProxy -ListenPort $ListenPort
    & netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort connectaddress=127.0.0.1 connectport=$ConnectPort | Out-Null
}

function Ensure-FirewallRule {
    param(
        [string]$DisplayName,
        [int]$LocalPort
    )

    $existing = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue
    if ($existing) {
        $existing | Set-NetFirewallRule -Enabled True -Direction Inbound -Action Allow
        return
    }

    New-NetFirewallRule `
        -DisplayName $DisplayName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $LocalPort | Out-Null
}

function Remove-FirewallRule {
    param([string]$DisplayName)

    Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
}

if ($ChromePort -eq $ProxyPort) {
    Write-Error "ChromePort and ProxyPort must be different. Chrome uses $ChromePort locally; the portproxy should expose a separate port such as 9223."
}

$firewallRuleName = "Hermes Chrome CDP $ProxyPort"
$chromeUrl = "http://127.0.0.1:$ChromePort/json/version"
$proxyUrl = "http://127.0.0.1:$ProxyPort/json/version"
$containerHostName = "host.docker.internal"
$containerUrl = "http://host.docker.internal:$ProxyPort"

Assert-Administrator

if ($Cleanup) {
    Write-Host "Removing portproxy for 0.0.0.0:$ProxyPort..."
    Remove-PortProxy -ListenPort $ProxyPort

    Write-Host "Removing firewall rule '$firewallRuleName'..."
    Remove-FirewallRule -DisplayName $firewallRuleName

    if ($RemoveProfile) {
        if (Test-Path -LiteralPath $ProfileDir) {
            Write-Host "Removing Chrome profile directory: $ProfileDir"
            Remove-Item -LiteralPath $ProfileDir -Recurse -Force
        }
    }
    else {
        Write-Host "Leaving Chrome profile directory in place: $ProfileDir"
        Write-Host "Pass -RemoveProfile with -Cleanup to delete it."
    }

    Write-Host "Cleanup complete."
    exit 0
}

$resolvedChromePath = Resolve-ChromePath -OverridePath $ChromePath
New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null

Write-Host "Launching Chrome CDP on 127.0.0.1:$ChromePort..."
$chromeArgs = @(
    "--remote-debugging-port=$ChromePort",
    "--remote-debugging-address=127.0.0.1",
    "--user-data-dir=""$ProfileDir""",
    "--no-first-run",
    "--no-default-browser-check"
)

Start-Process -FilePath $resolvedChromePath -ArgumentList $chromeArgs | Out-Null

Write-Host "Waiting for Chrome CDP at $chromeUrl..."
if (-not (Wait-CdpEndpoint -Url $chromeUrl)) {
    Write-Error "Chrome CDP did not become available at $chromeUrl. Close existing Chrome instances using port $ChromePort, then rerun this script."
}

Write-Host "Creating portproxy 0.0.0.0:$ProxyPort -> 127.0.0.1:$ChromePort..."
Add-PortProxy -ListenPort $ProxyPort -ConnectPort $ChromePort

Write-Host "Ensuring firewall rule '$firewallRuleName' allows inbound TCP $ProxyPort..."
Ensure-FirewallRule -DisplayName $firewallRuleName -LocalPort $ProxyPort

Write-Host "Verifying local proxy at $proxyUrl..."
if (-not (Wait-CdpEndpoint -Url $proxyUrl -Attempts 10)) {
    Write-Error "The portproxy was created, but $proxyUrl did not return Chrome CDP JSON. Check 'netsh interface portproxy show v4tov4' and Windows Firewall."
}

Write-Host ""
Write-Host "Chrome CDP is available to containers at:"
Write-Host $containerUrl
Write-Host ""
Write-Host "Test from inside the devcontainer:"
Write-Host "CDP_HOST=`$(getent ahostsv4 $containerHostName | awk 'NR==1 {print `$1}')"
Write-Host "curl http://`$CDP_HOST:$ProxyPort/json/version"
Write-Host ""
Write-Host "Hermes/CodeForge endpoint:"
Write-Host "http://`$CDP_HOST:$ProxyPort"
Write-Host ""
Write-Host "Why not use host.docker.internal directly?"
Write-Host "Chrome rejects non-IP Host headers for CDP. Use the resolved IPv4 address from inside the devcontainer."
