param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectRoot = (Get-Location).Path,

    [Parameter(Mandatory = $false)]
    [switch]$SkipInstall,

    [Parameter(Mandatory = $false)]
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-LoggedNative {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$LogFile
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $output = & $Command @Arguments 2>&1
        $exitCode = $LASTEXITCODE
        @($output) | Tee-Object -FilePath $LogFile

        if ($exitCode -ne 0) {
            throw "$Command terminó con código $exitCode. Revisa $LogFile"
        }
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
Set-Location -LiteralPath $ProjectRoot

if (-not (Test-Path -LiteralPath "package.json")) {
    throw "Ejecuta este script desde la raíz de RAPA-GO-V2.0.0."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logsDir = Join-Path $ProjectRoot "release-evidence/$timestamp"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

Write-Step "Verificando Git"
if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git no está disponible en PATH."
}

Invoke-LoggedNative -Command "git" -Arguments @("fetch", "origin", "--prune") -LogFile (Join-Path $logsDir "01-git-fetch.log")
Invoke-LoggedNative -Command "git" -Arguments @("status", "--short", "--branch") -LogFile (Join-Path $logsDir "02-git-status.log")

$porcelain = (& git status --porcelain 2>$null | Out-String).Trim()
if ($porcelain) {
    throw "El árbol Git tiene cambios sin commit. Haz commit o stash antes de congelar el release."
}

$currentBranch = ((& git branch --show-current 2>$null | Select-Object -First 1) -as [string]).Trim()
$currentHead = ((& git rev-parse HEAD 2>$null | Select-Object -First 1) -as [string]).Trim()

$hasOriginMain = $false
& git show-ref --verify --quiet refs/remotes/origin/main
$hasOriginMain = ($LASTEXITCODE -eq 0)

if ($hasOriginMain) {
    $counts = ((& git rev-list --left-right --count "origin/main...HEAD" 2>$null | Select-Object -First 1) -as [string]).Trim()
    $parts = $counts -split '\s+'
    $behind = if ($parts.Length -ge 1) { [int]$parts[0] } else { 0 }
    $ahead = if ($parts.Length -ge 2) { [int]$parts[1] } else { 0 }

    @(
        "Rama: $currentBranch",
        "Commit: $currentHead",
        "Detrás de origin/main: $behind",
        "Delante de origin/main: $ahead"
    ) | Out-File -FilePath (Join-Path $logsDir "03-git-release-state.txt") -Encoding utf8

    if ($behind -gt 0) {
        throw "La rama está $behind commit(s) detrás de origin/main. Integra main, resuelve conflictos, ejecuta este script nuevamente y genera otro commit de release."
    }
}

if (-not $SkipInstall) {
    Write-Step "Instalando dependencias reproducibles"
    Invoke-LoggedNative -Command "npm" -Arguments @("ci", "--no-audit", "--no-fund") -LogFile (Join-Path $logsDir "04-npm-ci.log")
}

Write-Step "Ejecutando typecheck"
Invoke-LoggedNative -Command "npm" -Arguments @("run", "typecheck") -LogFile (Join-Path $logsDir "05-typecheck.log")

if (-not $SkipTests) {
    Write-Step "Ejecutando pruebas"
    Invoke-LoggedNative -Command "npm" -Arguments @("run", "test", "--", "--run") -LogFile (Join-Path $logsDir "06-tests.log")
}

Write-Step "Construyendo todos los workspaces"
Invoke-LoggedNative -Command "npm" -Arguments @("run", "build:all") -LogFile (Join-Path $logsDir "07-build-all.log")

Write-Step "Verificando cierre técnico"
Invoke-LoggedNative -Command "npm" -Arguments @("run", "verify:release") -LogFile (Join-Path $logsDir "08-verify-release.log")
Invoke-LoggedNative -Command "npm" -Arguments @("run", "verify:routes") -LogFile (Join-Path $logsDir "09-verify-routes.log")

Write-Step "Generando manifiesto de evidencia"
$importantFiles = @(
    "package-lock.json",
    "apps/api/src/db/migrations/0042_production_closure.sql",
    "docs/release/sql/0042_production_closure_verify.sql",
    "apps/api/src/modules/auth/appleTokenRevocation.client.ts",
    "apps/api/src/modules/accountDeletion/accountDeletion.service.ts",
    "apps/api/src/jobs/retention.job.ts",
    "apps/mobile/ios/App/App/Info.plist",
    "docs/release/PRODUCTION_TECHNICAL_CLOSURE.md"
)

$manifest = New-Object System.Collections.Generic.List[string]
$manifest.Add("RAPA GO - RELEASE CANDIDATE")
$manifest.Add("Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$manifest.Add("Rama: $currentBranch")
$manifest.Add("Commit: $currentHead")
$manifest.Add("")

foreach ($relative in $importantFiles) {
    if (Test-Path -LiteralPath $relative) {
        $hash = Get-FileHash -LiteralPath $relative -Algorithm SHA256
        $manifest.Add("$($hash.Hash)  $relative")
    }
    else {
        $manifest.Add("FALTA  $relative")
    }
}

$manifest | Out-File -FilePath (Join-Path $logsDir "10-release-manifest-sha256.txt") -Encoding utf8

Write-Host ""
Write-Host "CIERRE TÉCNICO LOCAL APROBADO" -ForegroundColor Green
Write-Host "Evidencias: $logsDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Todavía debes aplicar la migración en Supabase, configurar Hostinger, probar Apple/SII y completar las consolas y firmas." -ForegroundColor Yellow
