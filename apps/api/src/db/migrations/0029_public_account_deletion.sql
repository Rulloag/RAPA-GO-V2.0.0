ALTER TABLE "account_deletion_requests"
  ADD COLUMN IF NOT EXISTS "tracking_code" varchar(32),
  ADD COLUMN IF NOT EXISTS "request_channel" varchar(20) DEFAULT 'app' NOT NULL,
  ADD COLUMN IF NOT EXISTS "contact_email_hash" varchar(64);

UPDATE "account_deletion_requests"
SET "tracking_code" = 'RAD-' || upper(substr(replace("id"::text, '-', ''), 1, 12))
WHERE "tracking_code" IS NULL;

ALTER TABLE "account_deletion_requests"
  ALTER COLUMN "tracking_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "account_deletion_requests_tracking_code_uidx"
  ON "account_deletion_requests" ("tracking_code");

CREATE INDEX IF NOT EXISTS "account_deletion_requests_channel_requested_idx"
  ON "account_deletion_requests" ("request_channel", "requested_at");

CREATE TABLE IF NOT EXISTS "account_deletion_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "email_hash" varchar(64) NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "attempts" integer DEFAULT 0 NOT NULL,
  "request_ip" varchar(64),
  "request_user_agent" varchar(500),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "account_deletion_verifications"
    ADD CONSTRAINT "account_deletion_verifications_user_id_users_id_fk"
    FOREIGN KEY ("user_id")
    REFERENCES "public"."users"("id")
    ON DELETE set null
    ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "account_deletion_verifications_email_created_idx"
  ON "account_deletion_verifications" ("email_hash", "created_at");

CREATE INDEX IF NOT EXISTS "account_deletion_verifications_expires_idx"
  ON "account_deletion_verifications" ("expires_at");


-- Publicar versiones legales operativas en la aplicación.
UPDATE "legal_documents"
SET "is_active" = false, "updated_at" = now()
WHERE "type" IN (
  'terms_and_conditions',
  'privacy_policy',
  'software_license',
  'user_conditions',
  'driver_conditions'
)
AND "version" <> '2.0';

INSERT INTO "legal_documents" (
  "type",
  "version",
  "title",
  "content",
  "effective_date",
  "is_active"
)
SELECT
  'privacy_policy',
  '2.0',
  'Política de Privacidad',
  $privacy$
RAPA GO — Haka Taiko SpA
Vigente desde el 19 de julio de 2026.

1. Responsable y alcance
RAPA GO es una plataforma de movilidad y servicios turísticos operada por Haka Taiko SpA en Rapa Nui, Chile. Esta política se aplica a la aplicación, panel administrativo y formularios web públicos.

2. Datos tratados
Podemos tratar nombre, correo, teléfono, RUT o pasaporte cuando corresponda; ubicación durante viajes activos; historial de viajes y reservas; datos de conductor y vehículo; pagos, comprobantes y beneficios; sesiones, dispositivo, IP y auditoría de seguridad.

3. Finalidades
Los datos se utilizan para administrar la cuenta, realizar viajes y reservas, calcular tarifas, procesar pagos, validar documentos, atender soporte, prevenir fraude, proteger a usuarios y cumplir obligaciones legales o tributarias.

4. Ubicación
La ubicación se usa para mapas, rutas, recogida y seguimiento durante un viaje activo. No debe utilizarse en segundo plano cuando no exista una función operacional activa que lo justifique.

5. Proveedores
RAPA GO puede utilizar proveedores de mapas, infraestructura, correo, notificaciones y pagos. Solo reciben la información necesaria para su función. RAPA GO no vende datos personales.

6. Conservación y eliminación
Los datos se conservan mientras la cuenta esté activa y después solo durante el tiempo requerido por obligaciones legales, tributarias, prevención de fraude o defensa de derechos. Al aprobarse una eliminación, se revocan sesiones, se bloquea el acceso y se elimina o anonimiza la información que no deba conservarse.

7. Derechos
Puedes solicitar acceso, rectificación, eliminación u oposición escribiendo a privacidad@rapago.cl o usando rapago.cl/eliminar-cuenta. La Ley N.º 19.628 se encuentra vigente. RAPA GO prepara sus procesos para la Ley N.º 21.719, cuya vigencia general comienza el 1 de diciembre de 2026.

8. Seguridad y contacto
RAPA GO utiliza controles de acceso por rol, cifrado en tránsito, sesiones revocables, auditoría y validaciones de archivos. Contacto: privacidad@rapago.cl y +56 9 4796 4171.
$privacy$,
  '2026-07-19',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "legal_documents"
  WHERE "type" = 'privacy_policy' AND "version" = '2.0'
);

INSERT INTO "legal_documents" (
  "type",
  "version",
  "title",
  "content",
  "effective_date",
  "is_active"
)
SELECT
  'terms_and_conditions',
  '2.0',
  'Términos y Condiciones',
  $terms$
RAPA GO — Términos y Condiciones
Vigentes desde el 19 de julio de 2026.

1. Cuenta y servicio
La información de registro debe ser verdadera. Cada persona es responsable de sus credenciales. RAPA GO conecta usuarios con conductores y permite gestionar servicios turísticos.

2. Tarifas
Antes de confirmar, la aplicación debe mostrar precio, moneda, forma de pago y condiciones relevantes. No se aplicarán cargos ocultos.

3. Cancelaciones
Viaje inmediato: cancelación gratuita durante los primeros 2 minutos desde la asignación. Desde el tercer minuto se cobra 30 % con tope de $3.000 CLP.
Viaje programado: gratuito hasta 30 minutos antes. Dentro de los últimos 30 minutos se cobra 30 % con tope de $3.000 CLP.
No presentación: después de 5 minutos de espera en el origen se cobra 50 % con tope de $5.000 CLP.
No corresponde cargo ante discrepancia de identidad o vehículo, riesgo de seguridad, duplicidad atribuible a la plataforma u otra causa imputable al operador o conductor.

4. Pagos y beneficios
El beneficio por pago de más en efectivo requiere aprobación administrativa, pertenece a la cuenta que pagó, no es transferible ni recargable y puede descontarse de un viaje posterior de esa misma cuenta.

5. Conducta
Está prohibido falsear identidad, hostigar, discriminar, manipular tarifas o poner en riesgo a terceros. RAPA GO puede suspender preventivamente una cuenta mientras investiga un caso.

6. Eliminación
La eliminación puede solicitarse desde la aplicación o en rapago.cl/eliminar-cuenta. La cuenta permanece activa hasta que administración apruebe la solicitud. Si se rechaza, se informará el motivo.

7. Soporte
Contacto oficial: +56 9 4796 4171 y rapago.cl/soporte.
$terms$,
  '2026-07-19',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "legal_documents"
  WHERE "type" = 'terms_and_conditions' AND "version" = '2.0'
);

INSERT INTO "legal_documents" (
  "type",
  "version",
  "title",
  "content",
  "effective_date",
  "is_active"
)
SELECT
  'software_license',
  '2.0',
  'Licencia de Software RAPA GO',
  $eula$
Haka Taiko SpA concede una licencia personal, limitada, revocable, no exclusiva y no transferible para instalar y utilizar RAPA GO en un dispositivo compatible.

No se permite copiar, vender, sublicenciar, distribuir, intentar obtener el código fuente, eludir controles de seguridad, interferir con la plataforma ni automatizar abusos de reservas, pagos o cuentas.

La aplicación puede requerir actualizaciones. Mapas, pagos, notificaciones y otros componentes pueden estar sujetos a términos de sus proveedores. El tratamiento de datos se rige por la Política de Privacidad.

La licencia termina si se incumplen estas condiciones o si la cuenta es eliminada. Este acuerdo se interpreta conforme a la legislación chilena, sin afectar derechos irrenunciables del consumidor.
$eula$,
  '2026-07-19',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "legal_documents"
  WHERE "type" = 'software_license' AND "version" = '2.0'
);

INSERT INTO "legal_documents" (
  "type",
  "version",
  "title",
  "content",
  "effective_date",
  "is_active"
)
SELECT
  'user_conditions',
  '2.0',
  'Condiciones para Usuarios',
  $users$
El usuario debe entregar información verdadera, mantener un trato respetuoso, verificar la identidad y el vehículo asignado, utilizar cinturón de seguridad y pagar el monto confirmado.

Puede rechazar o reportar un viaje por discrepancia de identidad o vehículo, riesgo de seguridad o conducta inadecuada. Las cancelaciones y no presentación se rigen por los Términos y Condiciones vigentes.

El usuario puede calificar un viaje completado, presentar reclamos y solicitar ayuda por objetos perdidos. No debe compartir contraseñas, códigos de verificación ni información completa de tarjetas.
$users$,
  '2026-07-19',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "legal_documents"
  WHERE "type" = 'user_conditions' AND "version" = '2.0'
);

INSERT INTO "legal_documents" (
  "type",
  "version",
  "title",
  "content",
  "effective_date",
  "is_active"
)
SELECT
  'driver_conditions',
  '2.0',
  'Condiciones para Conductores',
  $drivers$
El conductor debe mantener licencia, vehículo, patente y documentos vigentes; usar exclusivamente el vehículo aprobado o informar el préstamo autorizado; respetar la ruta, la seguridad vial y la privacidad del pasajero.

Debe aceptar, iniciar, completar o cancelar viajes únicamente mediante los estados de la aplicación. No puede cobrar montos distintos de la tarifa confirmada ni usar datos del pasajero fuera de la prestación del servicio.

Los incidentes, no presentación, pagos en efectivo y pagos de más deben registrarse en la aplicación. RAPA GO puede suspender o rechazar la habilitación cuando existan documentos vencidos, identidad inconsistente o riesgo de seguridad.
$drivers$,
  '2026-07-19',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "legal_documents"
  WHERE "type" = 'driver_conditions' AND "version" = '2.0'
);

-- Mantener activas las versiones 2.0 aunque la migración se ejecute nuevamente.
UPDATE "legal_documents"
SET "is_active" = true, "updated_at" = now()
WHERE "type" IN (
  'terms_and_conditions',
  'privacy_policy',
  'software_license',
  'user_conditions',
  'driver_conditions'
)
AND "version" = '2.0';
