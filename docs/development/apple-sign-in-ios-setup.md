# Sign in with Apple — configuración manual iOS

Este documento cubre los pasos manuales, fuera del código, necesarios para
que "Sign in with Apple" funcione en un build real de iOS. El backend
(`POST /api/auth/apple`) y el flujo móvil ya están implementados; lo que
sigue **no puede automatizarse** desde este repositorio.

## Estado de la integración

**Build nativo sin firma validado.** El proyecto nativo `apps/mobile/ios/`
compila en la parte web/TypeScript (typecheck, tests, build del bundle) y
también en Xcode: `Resolve Package Graph` completa con éxito (13 paquetes
SPM — 4 remotos desde GitHub público, el resto locales vía Capacitor) y

```bash
cd apps/mobile/ios/App
xcodebuild \
  -project App.xcodeproj \
  -scheme App \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

termina con `** BUILD SUCCEEDED **` (validado en Xcode 26.5 con el runtime
de iOS Simulator instalado). Esto confirma que el proyecto nativo, las
dependencias SPM y el entitlement de Sign in with Apple están correctamente
configurados a nivel de compilación.

Lo único que queda pendiente es lo que **no puede automatizarse ni
verificarse sin una cuenta de Apple Developer real** (ver secciones 1–3
abajo):

- Configurar el App ID en Apple Developer Portal y habilitar la capability.
- Seleccionar un Team en Xcode (Signing & Capabilities) para poder firmar.
- Probar el flujo Sign in with Apple end-to-end con credenciales reales.
- Validar en un dispositivo físico.

## 1. Apple Developer — pasos obligatorios

Requiere una cuenta de Apple Developer válida (de pago, $99/año) con acceso
al App ID `cl.rapago.app`.

1. **Registrar o confirmar el App ID** `cl.rapago.app` en
   [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. **Habilitar la capability "Sign in with Apple"** en ese App ID (checkbox
   en la sección Capabilities del identifier).
3. **Regenerar el provisioning profile** si ya existía uno para
   `cl.rapago.app` sin esta capability — los profiles existentes no se
   actualizan automáticamente al activar una capability nueva.
4. Si usas provisioning manual (no `Automatic` como está configurado por
   defecto en este proyecto), descarga el profile actualizado. **Nunca
   subas el archivo `.mobileprovision` ni certificados `.p12`/`.cer` a este
   repositorio.**
5. Confirma que `APPLE_ALLOWED_CLIENT_IDS` en el backend (`apps/api/.env`)
   incluye exactamente `cl.rapago.app` — sin esto, el backend rechaza
   cualquier `identityToken` real de Apple con `AUTH_APPLE_TOKEN_INVALID`
   (audiencia no permitida), aunque el flujo nativo en el dispositivo
   funcione perfectamente.

## 2. Xcode — pasos obligatorios

1. Generar el bundle web y sincronizar (ya ejecutado en este PR, repetir
   tras cualquier cambio en `apps/mobile/src`):
   ```bash
   cd apps/mobile
   npm run build
   npx cap sync ios
   ```
2. Abrir el workspace correcto (no el `.xcodeproj` directamente):
   ```bash
   npx cap open ios
   ```
3. En el navegador de Xcode, seleccionar el target **App**.
4. Pestaña **Signing & Capabilities**:
   - Seleccionar manualmente tu **Team** de Apple Developer (Xcode no lo
     hace automáticamente — el proyecto no fija ningún Team ID en el
     repositorio a propósito).
   - Confirmar que **Bundle Identifier** es `cl.rapago.app`.
   - Confirmar que la capability **Sign in with Apple** aparece listada
     (ya está declarada en `apps/mobile/ios/App/App/App.entitlements` con
     el valor `Default`, pero Xcode necesita un Team válido seleccionado
     para poder firmar con ese entitlement).
5. Verificar que **Automatically manage signing** esté activo, salvo que tu
   flujo de distribución use provisioning manual.
6. Compilar contra un simulador o dispositivo con iOS ≥ 15.0 (deployment
   target configurado en el proyecto).

**Nunca** subir a este repositorio: certificados, archivos
`.mobileprovision`, claves privadas (`.p8`, `.p12`), ni ningún Team ID
personal fuera del `App.xcodeproj` (que no lo contiene por diseño).

## 3. Prueba con credenciales reales

Sign in with Apple **no puede probarse en el simulador de iOS sin una
cuenta de Apple ID real** iniciada sesión en el simulador (Settings > Sign
in to your iPhone). En dispositivo físico, cualquier Apple ID real
funciona.

Checklist mínimo para considerar la integración validada:

- [ ] El botón "Sign in with Apple" aparece en `LoginPage` al correr en
      iOS nativo (no en el simulador de Safari/web).
- [ ] Un usuario nuevo completa el flujo, selecciona un rol, y llega a la
      pantalla correspondiente.
- [ ] Un segundo login con la misma cuenta de Apple entra directo, sin
      pedir rol de nuevo.
- [ ] Cancelar el diálogo nativo de Apple no muestra un mensaje de error.
- [ ] El backend recibe y verifica el `identityToken` real (revisar logs
      del backend — nunca deben aparecer tokens ni el nonce en esos logs).

## Referencia — variables de entorno del backend

Ver `apps/api/.env.example` y `apps/api/DEPLOY.md` para el detalle de
`APPLE_ALLOWED_CLIENT_IDS`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`,
`APPLE_PRIVATE_KEY` y `OAUTH_TOKEN_ENCRYPTION_KEY` — ninguna de estas se
gestiona desde Xcode ni desde este documento, viven exclusivamente en la
configuración del backend.
