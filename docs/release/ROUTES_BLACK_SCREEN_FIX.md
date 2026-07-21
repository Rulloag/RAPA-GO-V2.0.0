# RAPA GO — Corrección global de rutas negras

## Causa corregida

Ionic debe recibir las rutas como hijos directos de `IonRouterOutlet` dentro de
los layouts con pestañas. Los layouts anteriores enviaban un `Switch` y otros
componentes como hijos del outlet. Ionic no podía identificar cada ruta de
pasajero, conductor, administrador, guía o arriendo y podía mantener las
páginas ocultas con la clase interna `ion-page-hidden`.

El router principal también mezclaba `IonRouterOutlet` con un único `Switch`.
Se reemplazó por un `Switch` estándar en el nivel superior y se reservó
`IonRouterOutlet` para las pestañas, donde ahora recibe `Route` y `Redirect`
directamente.

## Cobertura

- Inicio de sesión, registro, recuperación y restablecimiento de contraseña.
- Rutas públicas legales, soporte y eliminación de cuenta.
- Pasajero, conductor y administrador.
- Rutas base `/passenger`, `/driver` y `/admin` con redirección explícita.
- Guía y arriendo cuando sus feature flags estén habilitadas.
- Ruta 404 para accesos inexistentes o funciones futuras deshabilitadas.
- Pantalla visible de carga de sesión.
- Pantalla de recuperación ante errores para evitar una vista completamente negra.
- Assets de Vite fijados a la raíz y fallback SPA de Hostinger.

## Sign in with Apple

El botón se muestra en el login web para confirmar que la opción existe. En un
navegador informa que la autenticación real está disponible en la aplicación
nativa de iPhone. En iOS utiliza el plugin nativo y continúa con el flujo real.

## Verificación

```powershell
npm run verify:routes
npm run typecheck --workspace=apps/mobile
npm run build:prod --workspace=apps/mobile
```
