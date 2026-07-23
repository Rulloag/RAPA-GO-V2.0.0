$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Users\leand\OneDrive\Escritorio\RAPA-GO-V2.0.0"
Set-Location -LiteralPath $ProjectRoot

$Checks = @(
  "apps/api/src/modules/auth/appleAuth.service.ts",
  "apps/api/src/modules/auth/appleIdentityToken.verifier.ts",
  "apps/api/src/db/migrations/0040_apple_identity_support.sql",
  "apps/mobile/src/features/auth/AppleSignInButton.tsx",
  "apps/mobile/ios/App/App/App.entitlements",
  "apps/mobile/ios/App/App/RapaGoBackgroundLocationPlugin.swift"
)

foreach ($Path in $Checks) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Falta: $Path" }
  Write-Host "OK: $Path" -ForegroundColor Green
}

npm.cmd run build --workspace=packages/shared
if ($LASTEXITCODE -ne 0) { throw "Falló shared." }
npm.cmd run typecheck --workspace=apps/api
if ($LASTEXITCODE -ne 0) { throw "Falló backend." }
npm.cmd run typecheck --workspace=apps/mobile
if ($LASTEXITCODE -ne 0) { throw "Falló mobile." }
npm.cmd run verify:release
if ($LASTEXITCODE -ne 0) { throw "Falló release." }

Push-Location ".\apps\api"
try {
  npx.cmd drizzle-kit check
  if ($LASTEXITCODE -ne 0) { throw "Falló Drizzle." }
  npx.cmd vitest run src/modules/auth/__tests__/appleAuth.integration.test.ts
  if ($LASTEXITCODE -ne 0) { throw "Fallaron pruebas Apple." }
}
finally { Pop-Location }

Write-Host ""
Write-Host "INTEGRACION APPLE E IOS: VERIFICACION TECNICA OK" -ForegroundColor Green
Write-Host "Falta validación manual con Apple Developer, Xcode e iPhone." -ForegroundColor Yellow
