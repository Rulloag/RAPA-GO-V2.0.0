# RAPA GO — Comprobantes PDF automáticos con ruta real

## Alcance

Este módulo genera documentos propios y sencillos de RAPA GO. El recibo de Uber se utilizó únicamente como referencia funcional; no se copiaron sus textos, diseño, iconos ni distribución.

El PDF de viaje completado muestra:

- mapa real construido desde `ride_location_updates`;
- línea azul de la ruta;
- marcador verde `R` para recogida;
- marcador rojo `D` para destino;
- origen y destino;
- pasajero;
- conductor;
- marca, modelo, color y patente;
- distancia y duración;
- forma de pago;
- monto final registrado por el backend.

También genera comprobantes independientes para cancelación y no-show, con la evidencia de aceptación legal disponible antes de la solicitud del viaje.

## Automatización

### Viaje completado

Cuando `ride_requests.status` cambia a `completed`, `RidesService.completeRide` encola el comprobante. El proceso:

1. recupera el viaje y sus ubicaciones reales;
2. solicita una imagen a Google Static Maps;
3. usa un trazado local de respaldo si Google no responde;
4. genera un PDF de una página;
5. lo almacena en el bucket privado `ride-receipts`;
6. lo envía por SMTP al pasajero;
7. registra envío, hash, intentos y errores en `ride_receipts`.

### Cancelación y no-show

El PDF se genera únicamente cuando el administrador aprueba el cargo y este queda en `approved_pending_next_ride`. No declara un débito inmediato de tarjeta: informa que el cargo fue aprobado para regularización.

### Conductor habilitado

El primer correo con el contrato sigue enviándose al aceptar electrónicamente. Cuando el administrador aprueba la postulación del conductor, se envía un segundo correo de habilitación y se adjunta nuevamente el contrato aceptado.

## Preparación de Supabase

Ejecutar, en orden:

1. `apps/api/src/db/migrations/0051_ride_receipts_and_driver_approval_email.sql`
2. `docs/release/sql/0051_ride_receipts_verify.sql`

El backend crea el bucket privado `ride-receipts` con la Service Role cuando se genera el primer documento.

## Google Maps

La variable `GOOGLE_MAPS_API_KEY` utilizada por Hostinger debe tener habilitada **Maps Static API**. La clave del backend debe estar restringida de forma compatible con solicitudes del servidor. No usar una clave limitada exclusivamente por referente web.

Variables:

```env
RIDE_RECEIPTS_ENABLED=true
RIDE_RECEIPTS_EMAIL_ENABLED=true
RIDE_RECEIPTS_MAP_PROVIDER=google
RIDE_RECEIPTS_BUCKET=ride-receipts
RIDE_RECEIPTS_SUPPORT_EMAIL=soporte@rapago.cl
RIDE_RECEIPTS_SUPPORT_PHONE=+56 9 4796 4171
RIDE_RECEIPTS_RETRY_INTERVAL_MINUTES=5
DRIVER_APPROVAL_EMAIL_ENABLED=true
```

Las variables SMTP existentes se mantienen en Hostinger. No guardar contraseñas en GitHub.

## Endpoints

- `GET /api/ride-receipts`: comprobantes del usuario autenticado.
- `GET /api/ride-receipts/:id/pdf`: descarga autorizada.
- `GET /api/admin/ride-receipts`: listado administrativo.
- `POST /api/admin/ride-receipts/:id/resend`: reintento manual administrativo.
- `POST /api/admin/applications/:id/approval/resend`: reenvío de la confirmación de conductor habilitado.

## Pruebas mínimas reales

1. Completar un viaje en efectivo con seguimiento GPS real.
2. Confirmar fila `sent` en `ride_receipts`.
3. Confirmar que el PDF contiene el mapa real y llega al correo.
4. Repetir con un viaje con tarjeta aprobada.
5. Aprobar un cargo de cancelación.
6. Aprobar un cargo no-show.
7. Aprobar una postulación de conductor y comprobar el segundo correo.
8. Probar descarga con el dueño del viaje y rechazo para otro usuario.

## Naturaleza del documento

Los archivos generados son **comprobantes de servicio**, no boletas ni facturas tributarias. La emisión tributaria requiere un flujo fiscal separado.
