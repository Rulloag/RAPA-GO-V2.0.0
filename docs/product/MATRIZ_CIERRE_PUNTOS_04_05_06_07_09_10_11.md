# RAPA GO — Cierre de Matriz: puntos 04, 05, 06, 07, 09, 10 y 11

**Fecha:** 20 de julio de 2026
**Responsable técnico:** Desarrollo RAPA GO
**Operador:** Haka Taiko SpA

## Resumen

Los puntos incluidos en este documento quedan definidos e implementados técnicamente. La publicación final exige aplicar la migración `0036_auth_identity_support_deletion_policy.sql`, desplegar backend y frontend juntos, y comprobar correo, rutas públicas y alertas en producción.

## 04 — EULA de Apple

**Estado:** Completado.

- Se adopta la EULA estándar de Apple para la licencia de la aplicación distribuida mediante App Store.
- La ruta pública `/eula` queda como referencia informativa.
- Los Términos y Condiciones de RAPA GO continúan regulando la cuenta, viajes, tarifas, pagos, cancelaciones y soporte; no se presentan como una EULA personalizada.

**Evidencia:**

- `apps/mobile/src/pages/public/PublicLegalPages.tsx`

## 05 — Google Login

**Estado:** Completado para la primera versión.

- Google Login no se incluye en el lanzamiento inicial.
- La revisión del código no encontró botones, rutas de autenticación, endpoints ni SDK de Google Login activos.
- Google Maps permanece porque es un proveedor de mapas y no un método de autenticación.
- La declaración de privacidad y formularios de tiendas no deben declarar Google Login como activo.

**Evidencia:**

- Rutas de autenticación limitadas a correo/contraseña y Facebook en `apps/api/src/modules/auth/auth.routes.ts`.
- No existen rutas `/google`, botones Google Login ni proveedor Google activo en la interfaz.

## 06 — Acceso posterior de cuentas creadas mediante Facebook

**Estado:** Completado técnicamente.

- El usuario puede continuar ingresando con Facebook después del registro.
- Desde Perfil > Seguridad puede crear una contraseña de respaldo.
- Si pierde acceso a Facebook puede iniciar recuperación mediante su correo verificado; el restablecimiento crea las credenciales cuando todavía no existían.
- La sesión expone `authProviders` y `hasPassword` para mostrar el estado real de seguridad de la cuenta.

**Evidencia:**

- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/passwordReset.service.ts`
- `apps/api/src/modules/auth/passwordReset.repository.ts`
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/mobile/src/pages/passenger/pages/ProfilePage.tsx`
- `apps/mobile/src/features/auth/auth.service.ts`

## 07 — Vinculación y fusión segura de cuentas

**Estado:** Completado técnicamente.

- Se incorpora la tabla persistente `auth_identities`.
- La identidad social utiliza el identificador estable entregado por el proveedor (`provider_subject`).
- No se fusiona automáticamente una cuenta existente solo porque Facebook entregue el mismo correo.
- Cuando el correo ya existe con contraseña u otra identidad, el sistema exige iniciar sesión en la cuenta existente y vincular Facebook explícitamente desde Perfil > Seguridad.
- La vinculación utiliza código de un solo uso, estado firmado, expiración y validación de identidad.
- Una identidad social no puede vincularse a dos usuarios distintos.

**Evidencia:**

- `apps/api/src/db/schema/authIdentities.schema.ts`
- `apps/api/src/modules/auth/authIdentities.repository.ts`
- `apps/api/src/modules/auth/facebookLoginExchange.repository.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/db/migrations/0036_auth_identity_support_deletion_policy.sql`

## 09 — Canales oficiales de soporte

**Estado:** Completado técnicamente y definido operacionalmente.

Canales oficiales:

- Centro de Ayuda dentro de la aplicación, con folio y seguimiento.
- WhatsApp institucional: `+56 9 4796 4171`.
- Soporte general: `soporte@rapago.cl`.
- Reclamos: `reclamos@rapago.cl`.
- Privacidad: `privacidad@rapago.cl`.

Las solicitudes relevantes quedan registradas en el backend mediante casos, eventos, estados y folios. No deben solicitarse contraseñas, códigos de acceso ni datos completos de tarjetas por estos canales.

**Evidencia:**

- `packages/shared/src/constants/contact.ts`
- `apps/mobile/src/pages/support/SupportCenterPage.tsx`
- `apps/mobile/src/pages/public/PublicLegalPages.tsx`
- `apps/api/src/modules/support/`

## 10 — Atención fuera de horario

**Estado:** Completado técnicamente y definido operacionalmente.

- Horario de atención humana: todos los días de 08:00 a 22:00, hora de Rapa Nui.
- No se anuncia atención humana 24/7.
- Fuera del horario, la solicitud se recibe automáticamente.
- Casos de seguridad o prioridad urgente generan una notificación administrativa de tipo `support_case_critical` con título de alerta crítica.
- Los casos no críticos se revisan en la siguiente jornada de atención.
- En emergencias reales se instruye priorizar servicios públicos de emergencia; RAPA GO no los reemplaza.

**Evidencia:**

- `packages/shared/src/constants/contact.ts`
- `apps/api/src/modules/support/support.service.ts`
- `apps/api/src/modules/support/__tests__/support.service.test.ts`
- `apps/mobile/src/pages/support/SupportCenterPage.tsx`
- `apps/mobile/src/pages/public/PublicLegalPages.tsx`

## 11 — Eliminación de cuenta

**Estado:** Completado técnicamente.

- Aplica a pasajeros y conductores.
- Existe inicio desde la aplicación y recurso web público.
- La solicitud dentro de la app exige reautenticación mediante código de seis dígitos enviado al correo de la cuenta.
- La eliminación no puede rechazarse discrecionalmente.
- Administración solo puede aplazar por una causa objetiva y temporal:
  - viaje activo;
  - pago pendiente;
  - saldo o beneficio pendiente;
  - reclamo o soporte abierto;
  - contracargo, fraude o investigación;
  - identidad no verificada;
  - obligación legal de conservación.
- La solicitud aplazada sigue vigente y el usuario recibe causa y fecha de revisión.
- Plazo ordinario máximo: 30 días desde la solicitud.
- La aprobación se bloquea mientras existan operaciones pendientes.
- Al completar:
  - se revocan sesiones y tokens;
  - se eliminan credenciales, identidades sociales, perfiles, documentos, medios de pago y datos bancarios;
  - se anonimiza la cuenta y las postulaciones;
  - se conservan de forma restringida viajes, pagos, comprobantes y aceptaciones legales cuando corresponda;
  - se registra un resumen de conservación y auditoría.

**Evidencia:**

- `apps/api/src/modules/accountDeletion/`
- `apps/api/src/db/schema/accountDeletionRequests.schema.ts`
- `apps/mobile/src/components/accountDeletion/AccountDeletionCard.tsx`
- `apps/mobile/src/components/accountDeletion/AccountDeletionAdminPanel.tsx`
- `apps/mobile/src/pages/public/PublicAccountDeletionPage.tsx`
- `apps/api/src/db/migrations/0036_auth_identity_support_deletion_policy.sql`

## Validaciones ejecutadas

- `npm run build --workspace=packages/shared`: aprobado.
- `npm run typecheck --workspace=apps/api`: aprobado.
- `npm run build --workspace=apps/api`: aprobado.
- `npm run build --workspace=apps/mobile`: aprobado.
- `npx drizzle-kit check`: aprobado.
- Pruebas específicas de autenticación, eliminación de cuenta y soporte: **36 aprobadas**.

## Condiciones de despliegue

1. Respaldar la base de datos.
2. Aplicar la migración `0036_auth_identity_support_deletion_policy.sql` mediante `npm run db:migrate`.
3. Desplegar backend y frontend del mismo commit.
4. Confirmar que los tres correos institucionales reciben mensajes.
5. Probar vinculación Facebook, creación y recuperación de contraseña.
6. Probar eliminación desde app y desde la URL pública.
7. Crear un caso crítico y confirmar la alerta administrativa.
