# Cierre técnico Apple e iOS — RAPA GO

## Integrado en el código

- Botón nativo **Continuar con Apple** en iOS.
- Nonce criptográfico y verificación de nonce en backend.
- Verificación de `identityToken` mediante JWKS, emisor, audiencia y expiración.
- Intercambio del código mediante `client_secret` ES256 generado en backend.
- Refresh token cifrado con AES-256-GCM.
- Identidad Apple principal almacenada en `oauth_identities`.
- `provider_client_id` conserva el audience original para revocación.
- Prohibición de fusión automática por coincidencia de correo.
- Vinculación autenticada desde Perfil > Seguridad.
- Revocación oficial `/auth/revoke` antes de anonimizar una cuenta.
- Solicitud fallida y reintentable si no se puede revocar.
- Migraciones `0040_apple_identity_support.sql` y `0042_production_closure.sql`.
- Proyecto Capacitor iOS y entitlement de Sign in with Apple.
- Permisos `When In Use` y `Always and When In Use`.
- `UIBackgroundModes=location`.
- Seguimiento conectado al flujo de viaje.

## Validación local requerida

Ejecutar desde el commit congelado:

```powershell
npm ci
npm run typecheck
npm run test -- --run
npm run build:all
npm run verify:release
npx cap sync ios
```

Guardar los logs en la carpeta de evidencia del release.

## Pendiente manual

- Apple Developer activo para Haka Taiko SpA.
- App ID, key, provisioning y certificados.
- Variables secretas correctas en Hostinger.
- Compilación y firma en Xcode/macOS.
- Pruebas reales en iPhone.
- Revocación real y nuevo registro con la misma cuenta Apple.
- TestFlight, App Privacy y aprobación final.

Ver `APPLE_ACCOUNT_DELETION_RUNBOOK.md` y `EXTERNAL_EVIDENCE_CHECKLIST.md`.
