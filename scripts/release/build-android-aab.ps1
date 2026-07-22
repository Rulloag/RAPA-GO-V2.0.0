$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$AndroidFolder = Join-Path $ProjectRoot "apps\mobile\android"
$OutputFolder = Join-Path $ProjectRoot "release-output"

$Required = @(
    "RAPAGO_ANDROID_KEYSTORE_PATH",
    "RAPAGO_ANDROID_KEYSTORE_PASSWORD",
    "RAPAGO_ANDROID_KEY_ALIAS",
    "RAPAGO_ANDROID_KEY_PASSWORD"
)

foreach ($Name in $Required) {
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Falta la variable segura $Name. No se generó ningún AAB."
    }
}

if (-not (Test-Path -LiteralPath $env:RAPAGO_ANDROID_KEYSTORE_PATH)) {
    throw "No existe el keystore indicado por RAPAGO_ANDROID_KEYSTORE_PATH."
}

if ([string]::IsNullOrWhiteSpace($env:RAPAGO_VERSION_CODE)) {
    $env:RAPAGO_VERSION_CODE = "20000"
}
if ([string]::IsNullOrWhiteSpace($env:RAPAGO_VERSION_NAME)) {
    $env:RAPAGO_VERSION_NAME = "2.0.0"
}

Set-Location -LiteralPath $ProjectRoot

# La build de tienda siempre cierra los módulos futuros.
$env:VITE_API_BASE_URL = "https://backend.rapago.cl/api"
$env:VITE_ENV = "production"
$env:VITE_ALLOW_FUTURE_FEATURES_IN_PRODUCTION = "false"
$env:VITE_FEATURE_TOURISM = "false"
$env:VITE_FEATURE_RENTALS = "false"
$env:VITE_FEATURE_EVENTS = "false"

npm.cmd run verify:release
if ($LASTEXITCODE -ne 0) { throw "Falló la verificación de lanzamiento." }

npm.cmd run build:prod --workspace=apps/mobile
if ($LASTEXITCODE -ne 0) { throw "Falló el build web de producción." }

Push-Location -LiteralPath (Join-Path $ProjectRoot "apps\mobile")
try {
    npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw "Falló Capacitor sync Android." }
}
finally {
    Pop-Location
}

Push-Location -LiteralPath $AndroidFolder
try {
    .\gradlew.bat clean bundleRelease
    if ($LASTEXITCODE -ne 0) { throw "Falló Gradle bundleRelease." }
}
finally {
    Pop-Location
}

$SourceAab = Join-Path $AndroidFolder "app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path -LiteralPath $SourceAab)) {
    throw "Gradle terminó, pero no se encontró app-release.aab."
}

New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
$DestinationAab = Join-Path $OutputFolder "RAPA-GO-$($env:RAPAGO_VERSION_NAME)-$($env:RAPAGO_VERSION_CODE).aab"
Copy-Item -LiteralPath $SourceAab -Destination $DestinationAab -Force

$Hash = Get-FileHash -LiteralPath $DestinationAab -Algorithm SHA256
$HashFile = "$DestinationAab.sha256.txt"
"$($Hash.Hash)  $([IO.Path]::GetFileName($DestinationAab))" | Set-Content -LiteralPath $HashFile -Encoding UTF8

Write-Host "AAB firmado creado:" -ForegroundColor Green
Write-Host $DestinationAab
Write-Host "SHA-256:" -ForegroundColor Green
Write-Host $Hash.Hash
