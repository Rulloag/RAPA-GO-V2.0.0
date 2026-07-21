# RAPA GO — Inventario de proveedores y SDK

**Regla:** ningún proveedor puede recibir secretos en el frontend. Las claves privadas, webhooks y credenciales viven exclusivamente en el servidor.

| Proveedor / SDK | Estado | Finalidad | Datos potencialmente tratados | Punto de integración | Control requerido |
|---|---|---|---|---|---|
| PostgreSQL administrado / Supabase | Activo | Base de datos principal | cuenta, viajes, pagos, documentos, soporte y auditoría | Backend `apps/api` | TLS, mínimo privilegio, respaldo y rotación de credenciales |
| Hostinger / infraestructura de despliegue | Activo | Alojar frontend/backend y logs | solicitudes HTTP, IP, user-agent y contenido procesado | Producción | Acceso administrativo restringido y logs sin secretos |
| Google Maps Platform | Activo | mapas, geocodificación, rutas y distancias | coordenadas, origen/destino y consultas de mapa | Frontend y backend | Restringir claves por dominio/app/API; no usar para publicidad |
| Meta Facebook Login | Activo | autenticación opcional | identificador de proveedor, nombre/correo autorizado y tokens de intercambio temporales | Backend auth y callback frontend | No fusionar cuentas automáticamente por correo; vinculación autenticada |
| Mercado Pago | Activo | pagos con tarjeta, conciliación y devoluciones al medio original | identificadores de pago, monto, estado y metadatos mínimos | Backend payments | Validar firma de webhook; no almacenar tarjeta/CVV |
| SMTP / Google Workspace | Activo | códigos, recuperación y notificaciones | correo, asunto, contenido transaccional | Backend mail service | Contraseña de aplicación solo en variables de entorno |
| WhatsApp / Meta Cloud API | Condicional | soporte y comunicaciones operacionales | teléfono y texto que el usuario decide enviar | Backend/links de soporte | Consentimiento contextual; no enviar documentos o claves por chat |
| Sentry React/Capacitor | Condicional, solo con DSN | diagnóstico de errores | stack traces, versión, dispositivo y contexto técnico minimizado | Inicialización frontend | Desactivar PII, redactar tokens, correos y números bancarios |
| Capacitor Secure Storage | Activo en móvil | guardar sesión cifrada en el dispositivo | token de sesión | Frontend nativo | Borrado en logout/revocación; no copiar a localStorage |
| Capacitor Geolocation | Activo | ubicación durante solicitud/viaje | coordenadas del dispositivo | Frontend nativo | Permiso contextual, detener al terminar/cancelar y copia solo temporal |
| Capacitor Local/Push Notifications | Condicional | avisos de viaje y operación | token push e identificadores de notificación | Frontend/backend cuando se habilita | Solicitar permiso y permitir desactivar |
| Capacitor Network/App/Splash/Preferences | Activo | estado técnico y experiencia nativa | datos técnicos mínimos del dispositivo | Frontend | No usar para perfilar ni identificar fuera del servicio |

## Proveedores retirados o no incluidos en el lanzamiento

- Google Login no forma parte de la primera versión. No debe existir botón, flujo OAuth ni declaración que indique que está disponible.

## Variables sensibles auditadas

El archivo `apps/api/.env.example` fue reemplazado por marcadores seguros. Nunca debe contener valores reales de:

- `DATABASE_URL`;
- `JWT_SECRET`;
- `BANK_ACCOUNT_ENCRYPTION_KEY`;
- claves privadas de Facebook, Mercado Pago, SMTP o WhatsApp;
- claves de Google Maps no restringidas.

## Revisión previa a producción

1. Confirmar contrato/condiciones y política de privacidad vigente de cada proveedor.
2. Confirmar región, subprocesadores y plazos de conservación aplicables.
3. Restringir claves por dominio, package/bundle ID, IP o firma según corresponda.
4. Desactivar SDK no utilizados.
5. Actualizar este inventario cuando se agregue o retire un proveedor.
