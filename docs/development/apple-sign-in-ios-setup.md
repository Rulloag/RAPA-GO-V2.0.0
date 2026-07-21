# RAPA GO — configuración manual de Sign in with Apple

El código de frontend, backend y proyecto iOS está integrado. Para probarlo y publicarlo todavía se requiere una membresía Apple Developer de Haka Taiko SpA, un Mac con Xcode y un iPhone real.

## 1. Apple Developer

1. Registrar el App ID explícito `cl.rapago.app`.
2. Activar la capability **Sign in with Apple**.
3. Crear una key para Sign in with Apple y guardar de forma segura su archivo `.p8` (se descarga una sola vez).
4. Registrar el Team ID y Key ID.
5. Regenerar el provisioning profile si existía antes de habilitar la capability.

Nunca guardar `.p8`, `.p12`, `.cer` o `.mobileprovision` en GitHub.

## 2. Variables del backend

Configurar en Hostinger, sin exponerlas en el frontend:

- `APPLE_ALLOWED_CLIENT_IDS=cl.rapago.app`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY` con saltos de línea escapados como `\\n`
- `OAUTH_TOKEN_ENCRYPTION_KEY` con 64 caracteres hexadecimales

Después aplicar la migración `0040_apple_identity_support.sql`.

## 3. Preparar Xcode

En un Mac:

```bash
cd apps/mobile
npm install
npm run build:prod
npx cap sync ios
npx cap open ios
```

En el target **App**:

- seleccionar el Team de Haka Taiko SpA;
- confirmar Bundle Identifier `cl.rapago.app`;
- verificar **Sign in with Apple** en Signing & Capabilities;
- verificar **Background Modes > Location updates**;
- mantener `App.entitlements` asociado al target;
- usar administración automática de firma, salvo que la empresa use perfiles manuales.

## 4. Pruebas obligatorias

- Usuario nuevo: Apple entrega correo/nombre, se aceptan los documentos legales y se crea una cuenta de pasajero.
- Segundo ingreso: entra directamente con el mismo `sub` estable de Apple.
- Correo privado relay: se conserva como correo del proveedor sin fusionar cuentas automáticamente.
- Correo ya existente: se exige ingresar por el método actual y vincular Apple desde Perfil > Seguridad.
- Cancelación del diálogo: no crea sesión ni muestra un error falso.
- Token inválido, audiencia incorrecta o nonce incorrecto: el backend rechaza la operación.
- Cierre de sesión: elimina la sesión local segura.
- Eliminación de cuenta: confirmar el procedimiento de revocación de Apple durante la validación final.

## 5. Evidencia requerida

Guardar capturas de Apple Developer, Signing & Capabilities, prueba en iPhone, logs sin tokens y resultado de TestFlight. No capturar claves privadas.
