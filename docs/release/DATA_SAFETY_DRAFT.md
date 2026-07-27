# Google Play Data Safety — borrador de cierre

> Este archivo es una guía para completar Play Console. La declaración final debe compararse con el AAB firmado mediante App Bundle Explorer y con la Política de Privacidad v2.1. No se debe marcar una respuesta únicamente porque aparezca en este documento.

## 1. Datos recopilados o tratados por funciones activas

| Categoría de Play Console | Datos usados por RAPA GO | Finalidad principal | Compartición / observación |
|---|---|---|---|
| Información personal | nombre, correo, teléfono e identificador interno | cuenta, autenticación, soporte y operación | proveedores de infraestructura y autenticación solo para prestar el servicio |
| Identificadores | ID de usuario, identificador estable de Apple/Facebook, token push cuando se habilite | autenticación, vinculación segura y notificaciones | no se venden |
| Ubicación | ubicación aproximada y precisa; coordenadas, precisión, rumbo y velocidad durante funciones operativas | origen, asignación, navegación, seguridad y seguimiento de viaje activo | Google Maps y backend según la función |
| Información financiera | identificadores de pago, monto, estado, referencia de transferencia y últimos cuatro dígitos bancarios | cobro, conciliación y reembolso | Mercado Pago y personal autorizado de Finanzas |
| Fotos y archivos | documentos de residencia; licencia, vehículo y acreditaciones del conductor | verificación y habilitación | acceso administrativo restringido |
| Actividad de la aplicación | viajes, reservas, estados, cancelaciones, no show, beneficios y calificaciones | prestación, soporte, seguridad y cumplimiento | no se usa para publicidad |
| Mensajes de soporte | consultas, reclamos, comentarios y archivos que el usuario decida aportar | soporte e investigación | acceso restringido según el caso |
| Información y rendimiento de la app | IP, user-agent, versión, registros de seguridad, diagnóstico y fallos si Sentry está habilitado | seguridad, prevención de abuso y estabilidad | Sentry solo cuando exista DSN y con PII minimizada |
| Dispositivo u otros identificadores | datos técnicos mínimos necesarios para notificaciones y funcionamiento nativo | operación técnica | confirmar en el AAB final |

## 2. Ubicación en segundo plano

- La aplicación solicita primero ubicación en uso.
- La autorización de segundo plano se solicita únicamente al conductor cuando necesita mantener el seguimiento de un viaje activo.
- Android utiliza un servicio en primer plano con notificación persistente.
- iOS declara el modo `location` y muestra los indicadores del sistema.
- El seguimiento debe detenerse al terminar, cancelar o perder autorización sobre el viaje.
- Las ubicaciones GPS detalladas tienen vencimiento técnico de 90 días.
- La aplicación no utiliza ubicación para publicidad ni perfilado entre aplicaciones.

En Play Console se debe justificar la ubicación en segundo plano con un video que muestre la función central: conductor con viaje activo, aplicación minimizada o pantalla bloqueada, notificación persistente y actualización de la ruta.

## 3. Eliminación de cuenta

- Disponible dentro de la aplicación y en `https://api.rapago.cl/eliminar-cuenta`.
- El motivo es opcional.
- La identidad se verifica mediante sesión autenticada o código en el flujo público.
- El plazo ordinario se cuenta desde la verificación.
- Solo se permite aplazar por causas objetivas y temporales.
- Se revocan sesiones y, cuando corresponda, la autorización de Sign in with Apple.
- Se eliminan o anonimizan los datos que no deban conservarse por obligación legal, fraude, contracargo, accidente, reclamo o defensa de derechos.

## 4. Conservación y eliminación

| Categoría | Regla técnica/documental |
|---|---|
| Ubicación GPS detallada | hasta 90 días |
| Códigos de eliminación vencidos/consumidos | purga después de 30 días |
| Intercambios efímeros de Facebook | purga después de 7 días |
| Datos bancarios cifrados y comprobante de transferencia | purga 30 días después del reembolso completado |
| Historial básico de viajes, incidentes y reclamos | hasta 5 años, sujeto a aprobación jurídica |
| Pagos, conciliaciones y documentos tributarios | 6 años o plazo obligatorio superior |
| Logs de seguridad e IP | hasta 12 meses, salvo investigación activa |
| Soporte ordinario | hasta 24 meses desde el cierre |
| Backups | ciclo documentado del proveedor; no deben reactivar una cuenta eliminada |

## 5. Seguridad declarable

- TLS en tránsito.
- Contraseñas con hash; no se almacenan en texto claro.
- Tokens de sesión en almacenamiento seguro nativo.
- Refresh tokens de Apple cifrados en backend.
- Números bancarios cifrados con AES-256-GCM y minimización posterior.
- Control de acceso por rol.
- CORS, Helmet, rate limiting y auditoría de eventos sensibles.
- Revocación de sesiones al completar eliminación de cuenta.
- Tráfico HTTP claro y backup de Android desactivados.

## 6. Publicidad, tracking e IDFA

- Facebook se utiliza para autenticación, no para publicidad.
- El código de la versión auditada no incorpora Facebook SDK móvil, App Events publicitarios ni solicitud de IDFA.
- No debe declararse tracking entre aplicaciones o sitios de terceros salvo que una revisión del binario final demuestre lo contrario.
- Confirmar Limited Login/configuración de Meta y App Tracking Transparency en la build iOS final.
- Sentry y cualquier otro SDK deben configurarse sin PII y reconciliarse con el binario firmado.

## 7. Datos no almacenados por RAPA GO

- Número completo de tarjeta.
- CVV.
- Contraseña de la cuenta en texto claro.
- Claves privadas Apple, Mercado Pago, Supabase o SMTP en el frontend.
- IDFA con fines publicitarios, según la implementación auditada.

## 8. Revisión obligatoria del AAB antes de enviar

1. Generar el AAB firmado desde el commit final.
2. Abrirlo en App Bundle Explorer.
3. Revisar permisos, SDK, librerías nativas y servicios.
4. Confirmar `ACCESS_BACKGROUND_LOCATION`, servicio en primer plano y notificaciones.
5. Comparar los SDK detectados con `docs/privacy/PROVIDERS_AND_SDK.md`.
6. Completar Data Safety usando el comportamiento real del binario.
7. Adjuntar capturas y exportar la respuesta final a `EVIDENCIAS-PRODUCCION/04-GOOGLE-PLAY/`.
8. Obtener aprobación de Desarrollo y Jurídica.
