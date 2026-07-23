# RAPA GO — Corrección global de rutas negras

## Causa principal corregida

El monorepo instalaba **dos copias diferentes de React**:

- raíz del proyecto: React 18.2.0;
- `apps/mobile`: React 18.3.1.

`react-router` se cargaba con la copia de la raíz, mientras que la aplicación y
`react-dom` podían usar la copia de `apps/mobile`. Al ejecutar hooks como
`useHistory()` o `useContext()`, React detectaba runtimes distintos y lanzaba
`Invalid hook call`. El resultado visible era un `<ion-app>` vacío y todas las
rutas quedaban negras.

La corrección deja React y React DOM en 18.3.1 en todo el monorepo, incorpora
`overrides` en el `package.json` raíz y añade `resolve.dedupe` en Vite para
impedir que React, React DOM o React Router vuelvan a duplicarse.

## Otras protecciones aplicadas

- `RouteErrorBoundary` ahora envuelve también `IonReactRouter` y
  `AppProviders`. Si falla la restauración de sesión o un proveedor global, se
  muestra una pantalla de recuperación en lugar de una vista negra.
- `#root`, `ion-app`, `html` y `body` usan el alto completo de la ventana.
- Los scripts `pretypecheck`, `prebuild` y `prebuild:prod` compilan primero
  `@rapa-go/shared`. Así una instalación limpia ya no falla porque falte
  `packages/shared/dist`.
- Ionic recibe las rutas como hijos directos de `IonRouterOutlet` dentro de los
  layouts con pestañas. No se anida un `Switch` dentro del outlet.
- Vite mantiene `base: "/"` y Hostinger conserva el fallback SPA mediante
  `.htaccess`.

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

## Verificación

Desde la raíz del proyecto:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm ci
npm run verify:routes
npm run typecheck --workspace=apps/mobile
npm run build:prod --workspace=apps/mobile
npm ls react react-dom
```

La última orden debe mostrar una sola versión de React y React DOM: 18.3.1.
El compilado listo para Hostinger queda en `apps/mobile/dist`.
