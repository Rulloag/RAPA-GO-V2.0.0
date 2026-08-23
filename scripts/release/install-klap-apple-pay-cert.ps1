param(
    [Parameter(Mandatory = $true)]
    [string]$CertPath,

    [Parameter(Mandatory = $false)]
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $CertPath)) {
    throw "No existe el certificado: $CertPath"
}

$targetDir = Join-Path $RepoRoot "apps/mobile/public/.well-known"
$targetFile = Join-Path $targetDir "apple-developer-merchantid-domain-association.txt"

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Copy-Item -LiteralPath $CertPath -Destination $targetFile -Force

Write-Host ""
Write-Host "Certificado Apple Pay instalado en:" -ForegroundColor Green
Write-Host "  $targetFile"
Write-Host ""
Write-Host "URL publica para responder a Klap:" -ForegroundColor Cyan
Write-Host "  https://api.rapago.cl/.well-known/apple-developer-merchantid-domain-association.txt"
Write-Host ""
Write-Host "Siguiente paso: rebuild frontend + desplegar en Hostinger public_html." -ForegroundColor Yellow
