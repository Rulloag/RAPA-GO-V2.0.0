# Cierre de matriz — Bloque A, puntos 12 al 16

## Punto 12 — Página pública de eliminación

- Ruta pública `/eliminar-cuenta`, accesible sin iniciar sesión.
- Verificación por código de seis dígitos enviado al correo de la cuenta.
- Motivo obligatorio, observación opcional y aceptación expresa.
- Folio de seguimiento y consulta pública de estado.
- Plazo ordinario máximo de 30 días y causales objetivas de aplazamiento.
- Contacto oficial `privacidad@rapago.cl` visible.
- `public/delete-account.html`, sitemap y reglas de hosting dirigen a la ruta pública.

**Estado:** completado.

## Punto 13 — Devolución de pagos en exceso

- El usuario elige de forma excluyente: Beneficio para próximo viaje o devolución bancaria.
- La devolución solo aplica a un viaje completado y pagado en efectivo, perteneciente a la misma cuenta.
- Exige cuenta bancaria registrada; el número completo queda cifrado AES-256-GCM.
- Solicitud persistente con monto, viaje, estado, motivo y snapshot bancario.
- Admin puede revisar, aprobar, rechazar, abrir temporalmente el dato bancario y registrar referencia/comprobante.
- Usuario ve el estado y comprobante desde Beneficios.
- Trigger de base de datos evita que un viaje genere simultáneamente Beneficio y devolución.

**Estado:** completado.

## Punto 14 — Matriz de datos personales

- Se creó `docs/privacy/PERSONAL_DATA_MATRIX.md` con dato, titular, finalidad, almacenamiento, acceso, proveedor y conservación/eliminación.
- Incluye identidad, documentos, geolocalización, viajes, pagos, banco, soporte, eliminación y logs.

**Estado:** completado, sujeto a validación jurídica final de plazos legales concretos.

## Punto 15 — localStorage y sessionStorage

- Inventario documentado en `docs/privacy/CLIENT_STORAGE_INVENTORY.md`.
- Política centralizada de limpieza entre cuentas y en logout/revocación.
- Sesión en almacenamiento seguro nativo.
- Ubicación viva migrada a `sessionStorage`.
- Backend declarado como fuente de verdad; caches heredadas no autorizan operaciones financieras ni de identidad.

**Estado:** completado para el cierre técnico de lanzamiento.

## Punto 16 — Proveedores y SDK

- Inventario en `docs/privacy/PROVIDERS_AND_SDK.md`.
- Se documentaron finalidad, datos, estado y controles de cada proveedor.
- `.env.example` fue sanitizado y se agregó la clave dedicada de cifrado bancario.
- Google Login permanece fuera del lanzamiento.

**Estado:** completado.
