# RAPA GO — Inventario de localStorage, sessionStorage y almacenamiento seguro

**Revisión técnica:** Bloque A, puntos 12–16.
**Archivos revisados:** 27 archivos TypeScript/TSX con uso de Web Storage.
**Referencias detectadas al cierre:** 628 de `localStorage` y 93 de `sessionStorage`, incluidas capas de compatibilidad heredadas.

## Política aplicada

| Tipo | Permitido | Ejemplos | Limpieza |
|---|---|---|---|
| Secure Storage nativo | Sesión y token de acceso | Sesión autenticada | Al cerrar sesión, revocación o eliminación de cuenta |
| `localStorage` | Solo preferencias no sensibles que deben sobrevivir reinicios | idioma y modo/rol visual | Se conservan al cerrar sesión |
| `sessionStorage` | Estado efímero de la pestaña o proceso actual | ubicación viva, formularios temporales | Al cerrar sesión o cerrar la sesión del navegador |
| Backend | Toda fuente de verdad | usuarios, viajes, pagos, saldo, devoluciones, documentos | Según política de cuenta y conservación |

## Preferencias permitidas en localStorage

- `rapago_language` y claves heredadas equivalentes de idioma.
- `rapago_active_role`, `rapago_selected_role`, `rapago_view_mode` y `rapago_active_mode` como preferencias de presentación.

## Datos que se limpian centralmente

`clientStoragePolicy.clearSensitiveClientStorage()` elimina al cerrar sesión, al detectar una sesión inválida y antes de autenticar otra cuenta:

- perfiles, correo, teléfono, RUT, pasaporte y nacionalidad;
- estados y metadatos de residencia;
- copias de viajes, solicitudes, reservas, rutas y notificaciones;
- cierres de efectivo, pagos pendientes, Beneficios y saldos visuales;
- vehículos, documentos, calificaciones y perfiles públicos cacheados;
- ubicaciones y colas operacionales;
- claves heredadas de sesión o autenticación.

## Cambios técnicos del Bloque A

1. Se agregó `apps/mobile/src/services/storage/clientStoragePolicy.ts`.
2. `AuthProvider` ejecuta la limpieza en logout, sesión revocada/restauración fallida y antes de login/registro.
3. `DriverLocationRuntime` y `PassengerLocationRuntime` usan `sessionStorage` para ubicación viva; no persiste después de cerrar la pestaña/sesión.
4. El token real continúa en Capacitor Secure Storage, no en Web Storage.
5. Las copias locales heredadas permanecen solo por compatibilidad visual/offline y no son autoridad financiera ni operacional.

## Riesgo residual controlado

El código heredado aún contiene numerosas copias locales para funcionamiento offline y compatibilidad. El control compensatorio actual es: backend como fuente de verdad, limpieza completa entre cuentas y prohibición de usar esas copias para aprobar pagos, devoluciones, identidad o documentos. Cada módulo nuevo debe evitar crear nuevas claves personales en `localStorage`.
