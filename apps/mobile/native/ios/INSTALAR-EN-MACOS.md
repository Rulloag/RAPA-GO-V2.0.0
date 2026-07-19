# RAPA GO — Integración iOS de ubicación en segundo plano

El ZIP auditado no contenía `apps/mobile/ios`, por lo que Windows no puede validar ni compilar el proyecto Xcode. En un Mac:

1. Desde `apps/mobile`, ejecutar `npx cap add ios` si la plataforma todavía no existe.
2. Copiar `native/ios/RapaGoBackgroundLocationPlugin.swift` a `ios/App/App/` y agregarlo al target **App** en Xcode.
3. Combinar las claves de `native/ios/Info.plist.location.fragment.xml` dentro de `ios/App/App/Info.plist`.
4. En **Signing & Capabilities**, agregar **Background Modes** y marcar **Location updates**.
5. Ejecutar `npm run build`, `npx cap sync ios` y abrir con `npx cap open ios`.
6. Probar en un iPhone físico: permiso *Mientras se usa*, luego *Siempre*, bloquear pantalla durante un viaje y confirmar que el pasajero recibe puntos.

No habilitar otros modos en segundo plano. La ubicación persistente se usa exclusivamente durante un viaje activo y se detiene al finalizar/cancelar.
