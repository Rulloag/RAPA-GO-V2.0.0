# Cierre técnico Apple e iOS — RAPA GO

## Integrado en el código

- Botón nativo **Continuar con Apple** solo en iOS.
- Nonce criptográfico y verificación de nonce en backend.
- Verificación del `identityToken` mediante JWKS de Apple, algoritmo RS256, emisor, audiencia y expiración.
- Intercambio del código de autorización mediante `client_secret` ES256 generado en backend.
- Refresh token cifrado con AES-256-GCM.
- Identidad Apple almacenada en la tabla existente `auth_identities`.
- Prohibición de fusión automática por coincidencia de correo.
- Vinculación autenticada desde Perfil > Seguridad.
- Migración `0040_apple_identity_support.sql`.
- Proyecto Capacitor iOS, entitlement de Apple y Swift Package del plugin.
- Permisos `When In Use` y `Always and When In Use` para ubicación.
- `UIBackgroundModes=location`.
- Plugin Swift `RapaGoBackgroundLocationPlugin` agregado al target Xcode.
- Inicio y término del seguimiento conectados al flujo existente de viaje.

## Validaciones ejecutadas fuera de macOS

- TypeScript shared: OK.
- Backend typecheck y build: OK.
- Frontend iOS/Android typecheck y build de producción: OK.
- `npx cap sync ios`: OK; detectó Apple Sign In, Geolocation, Local Notifications, Push y demás plugins.
- Verificación de release de los puntos 25/26: OK.
- Pruebas backend: 117 pruebas existentes aprobaron; una suite administrativa requiere `DATABASE_URL` y no puede ejecutarse sin el entorno de prueba.

## Pendiente manual, no resoluble dentro del ZIP

- Inscripción y aprobación de Apple Developer para Haka Taiko SpA.
- App ID/capabilities/key/provisioning de la cuenta empresarial.
- Variables secretas en Hostinger.
- Compilar y firmar en Xcode sobre macOS.
- Pruebas reales en iPhone, pantalla bloqueada, segundo plano, pérdida de GPS/red y recuperación.
- TestFlight, App Privacy y aprobación final de tienda.
