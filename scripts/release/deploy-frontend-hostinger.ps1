param(
    [Parameter(Mandatory = $false)]
    [string]$ZipPath = "",

    [Parameter(Mandatory = $false)]
    [string]$SshHost = "u269513748@212.85.6.237",

    [Parameter(Mandatory = $false)]
    [int]$SshPort = 65002,

    [Parameter(Mandatory = $false)]
    [string]$RemotePublicHtml = "~/domains/api.rapago.cl/public_html"
)

$ErrorActionPreference = "Stop"

if (-not $ZipPath) {
    $latest = Get-ChildItem -Path (Join-Path $PSScriptRoot "../../release-zips") -Filter "rapago-frontend-*.zip" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($latest) {
        $ZipPath = $latest.FullName
    }
    else {
        $desktop = Get-ChildItem -Path (Join-Path $env:USERPROFILE "Desktop") -Filter "rapago-frontend-*.zip" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($desktop) {
            $ZipPath = $desktop.FullName
        }
    }
}

if (-not $ZipPath -or -not (Test-Path -LiteralPath $ZipPath)) {
    throw "No se encontró el ZIP frontend. Pasa -ZipPath o genera uno con build:prod."
}

$ZipPath = (Resolve-Path -LiteralPath $ZipPath).Path
$zipName = Split-Path -Leaf $ZipPath

Write-Host ""
Write-Host "==> Subiendo frontend a Hostinger" -ForegroundColor Cyan
Write-Host "    ZIP: $ZipPath"
Write-Host "    Destino: $RemotePublicHtml"
Write-Host ""
Write-Host "Te pedirá la contraseña SSH dos veces (scp y ssh)." -ForegroundColor Yellow
Write-Host ""

scp -P $SshPort $ZipPath "${SshHost}:~/"

$remoteCmd = @"
set -e
cd $RemotePublicHtml
echo 'Desplegando en:' \$(pwd)
unzip -o ~/$zipName
ls -la index.html .htaccess assets | head -5
echo 'DEPLOY_FRONTEND_OK'
"@

ssh -p $SshPort $SshHost $remoteCmd

Write-Host ""
Write-Host "Frontend publicado. Prueba: https://api.rapago.cl" -ForegroundColor Green
