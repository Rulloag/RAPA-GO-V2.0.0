-- RAPA GO · Cierre técnico para producción
-- Idempotente. Corrige eliminación de cuenta, revocación Apple,
-- client_id de identidades, conservación y documentos legales v2.1.

BEGIN;

-- 0. Reparar la tabla OAuth Apple si la migración histórica 0037 no fue
-- registrada por Drizzle debido a la existencia de otro archivo 0037.
CREATE TABLE IF NOT EXISTS public.oauth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider varchar(30) NOT NULL,
  provider_user_id varchar(255) NOT NULL,
  provider_email varchar(255),
  provider_email_verified boolean DEFAULT false NOT NULL,
  provider_is_private_email boolean DEFAULT false NOT NULL,
  provider_client_id varchar(255),
  encrypted_refresh_token text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT uq_oauth_identities_provider_user
    UNIQUE(provider, provider_user_id),
  CONSTRAINT chk_oauth_identities_provider
    CHECK (provider IN ('apple'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user_id
  ON public.oauth_identities (user_id);

-- Si la tabla ya existía, CREATE TABLE IF NOT EXISTS no agrega las
-- restricciones declaradas dentro de la definición. Las aseguramos aquí.
CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_identities_provider_user
  ON public.oauth_identities (provider, provider_user_id);

DO $oauth_provider_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_oauth_identities_provider'
      AND conrelid = 'public.oauth_identities'::regclass
  ) THEN
    ALTER TABLE public.oauth_identities
      ADD CONSTRAINT chk_oauth_identities_provider
      CHECK (provider IN ('apple')) NOT VALID;

    ALTER TABLE public.oauth_identities
      VALIDATE CONSTRAINT chk_oauth_identities_provider;
  END IF;
END
$oauth_provider_constraint$;

-- 1. Conservar el client_id original de Apple para revocar el token
-- con el mismo App ID / Services ID que lo emitió.
ALTER TABLE public.oauth_identities
  ADD COLUMN IF NOT EXISTS provider_client_id varchar(255);

ALTER TABLE public.auth_identities
  ADD COLUMN IF NOT EXISTS provider_is_private_email boolean
    DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token text,
  ADD COLUMN IF NOT EXISTS provider_client_id varchar(255);

CREATE INDEX IF NOT EXISTS auth_identities_apple_user_idx
  ON public.auth_identities (user_id)
  WHERE provider = 'apple' AND revoked_at IS NULL;

-- 2. El motivo de eliminación es voluntario.
ALTER TABLE public.account_deletion_requests
  ALTER COLUMN reason DROP NOT NULL;

-- 3. El plazo de 30 días se cuenta desde la verificación de identidad.
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

UPDATE public.account_deletion_requests
SET verified_at = requested_at
WHERE verified_at IS NULL;

ALTER TABLE public.account_deletion_requests
  ALTER COLUMN verified_at SET DEFAULT now();

ALTER TABLE public.account_deletion_requests
  ALTER COLUMN verified_at SET NOT NULL;

UPDATE public.account_deletion_requests
SET deadline_at = verified_at + interval '30 days'
WHERE deadline_at IS NULL
   OR deadline_at <> verified_at + interval '30 days';

-- 4. Evidencia segura de la revocación de Sign in with Apple.
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS apple_revocation_status varchar(30)
    DEFAULT 'not_applicable' NOT NULL,
  ADD COLUMN IF NOT EXISTS apple_revocation_attempted_at
    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS apple_revoked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS apple_revocation_error text;

-- El estado genérico "rejected" deja de utilizarse.
UPDATE public.account_deletion_requests
SET
  status = 'identity_not_verified',
  decision_reason_code = coalesce(
    decision_reason_code,
    'identity_unverified'
  ),
  updated_at = now()
WHERE status = 'rejected';

-- Una solicitud fallida sigue abierta y puede reintentarse.
DROP INDEX IF EXISTS
  account_deletion_requests_one_open_per_user_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS
  account_deletion_requests_one_open_per_user_uidx
ON public.account_deletion_requests (user_id)
WHERE status IN (
  'pending',
  'deferred',
  'approved',
  'processing',
  'failed'
);

CREATE INDEX IF NOT EXISTS
  account_deletion_requests_verified_deadline_idx
ON public.account_deletion_requests (status, verified_at, deadline_at);

CREATE INDEX IF NOT EXISTS
  account_deletion_requests_apple_revocation_idx
ON public.account_deletion_requests (
  apple_revocation_status,
  apple_revocation_attempted_at
);

-- 5. Minimización de antecedentes bancarios de reembolsos.
ALTER TABLE public.cash_overpayment_refund_requests
  ALTER COLUMN bank_account_number_encrypted DROP NOT NULL;

ALTER TABLE public.cash_overpayment_refund_requests
  ADD COLUMN IF NOT EXISTS sensitive_data_purged_at
    timestamp with time zone;

-- 6. Documentos legales v2.1 alineados con la implementación final.
DO $legal$
DECLARE
  document_record record;
  selected_document_id uuid;
BEGIN
  FOR document_record IN
    SELECT *
    FROM (
      VALUES
        (
          'terms_and_conditions'::text,
          '2.1'::text,
          'Términos y Condiciones'::text,
          $doc0$RAPA GO — Términos y Condiciones
Operador: Haka Taiko SpA.
Versión 2.1. Vigente desde el 23 de julio de 2026.

1. Servicio y cuenta
RAPA GO permite solicitar y administrar viajes y servicios relacionados. La persona usuaria debe entregar información verdadera, proteger sus credenciales y mantener actualizados sus datos.

2. Tarifas
Antes de confirmar un viaje, la aplicación informa el valor, moneda, modalidad de pago y condiciones aplicables. La categoría “RAPA NUI / RESIDENTE RAPA NUI” corresponde a una tarifa territorial sujeta a acreditación y revisión administrativa; no constituye una declaración de pertenencia étnica.

3. Cancelación de viaje inmediato
La cancelación es gratuita durante los primeros dos minutos contados desde la aceptación o asignación del conductor. Desde el tercer minuto se puede aplicar un cargo equivalente al 30 % del valor del viaje, con un máximo de $3.000 CLP.

4. Viaje programado
La cancelación es gratuita hasta treinta minutos antes de la hora reservada. Dentro de los últimos treinta minutos se puede aplicar un cargo equivalente al 30 % del valor del viaje, con un máximo de $3.000 CLP.

5. No presentación
Cuando el conductor se encuentre en el punto de origen y espere al menos cinco minutos sin que el pasajero se presente, puede solicitarse un cargo equivalente al 50 % del valor del viaje, con un máximo de $5.000 CLP. Una vez aprobado, el 50 % corresponde al conductor y el 50 % a RAPA GO.

6. Excepciones
No corresponde el cargo cuando exista diferencia comprobable de identidad o vehículo, riesgo de seguridad, duplicidad atribuible a la plataforma, incumplimiento del conductor u otra causa imputable a RAPA GO.

7. Pagos y beneficios
El comprobante del procesador de pago no reemplaza el documento tributario que corresponda. El beneficio por pago de más en efectivo requiere revisión administrativa, pertenece a la misma cuenta que pagó, no es transferible ni recargable y no se descuenta de pagos con tarjeta.

8. Eliminación de cuenta
La eliminación puede solicitarse dentro de la aplicación o en https://api.rapago.cl/eliminar-cuenta. El motivo es opcional. RAPA GO verifica la identidad y procesa la solicitud dentro de treinta días desde esa verificación. Solo puede aplazarla por una causa objetiva, como un viaje activo, saldo o pago pendiente, reclamo, contracargo, fraude o una obligación legal. No existe rechazo discrecional. La cuenta puede desactivarse aunque determinados registros mínimos deban conservarse por obligación legal o defensa de derechos.

9. Soporte y documentos
Soporte: https://api.rapago.cl/soporte.
Privacidad: https://api.rapago.cl/privacidad.
EULA: https://api.rapago.cl/eula.$doc0$::text,
          '2026-07-23'::text
        ),
        (
          'user_conditions'::text,
          '2.1'::text,
          'Condiciones para Usuarios'::text,
          $doc1$RAPA GO — Condiciones para Usuarios
Versión 2.1. Vigente desde el 23 de julio de 2026.

Estas condiciones complementan los Términos y Condiciones Generales. En caso de contradicción, prevalecen los Términos y Condiciones Generales.

La persona usuaria debe entregar información verdadera, tratar respetuosamente al conductor, verificar identidad y vehículo, utilizar los elementos de seguridad disponibles y pagar el monto confirmado. Puede reportar diferencias de identidad, vehículo, riesgos, cobros o incidentes. Las reglas de cancelación, no presentación, pagos, privacidad, conservación y eliminación de cuenta son las publicadas en los Términos y en la Política de Privacidad vigentes.$doc1$::text,
          '2026-07-23'::text
        ),
        (
          'driver_conditions'::text,
          '2.1'::text,
          'Condiciones para Conductores'::text,
          $doc2$RAPA GO — Condiciones para Conductores
Versión 2.1. Vigente desde el 23 de julio de 2026.

El conductor debe mantener identidad, licencia, vehículo y documentación vigentes; utilizar el vehículo aprobado o autorizado; proteger los datos del pasajero; registrar los estados reales del viaje; y no cobrar sumas distintas de las informadas.

Cancelación de viaje inmediato: gratuita durante los primeros dos minutos desde la aceptación o asignación. Desde el tercer minuto se puede aplicar un cargo de 30 % con máximo de $3.000 CLP.

Viaje programado: gratuito hasta treinta minutos antes. Dentro de los últimos treinta minutos se puede aplicar un cargo de 30 % con máximo de $3.000 CLP.

No presentación: después de cinco minutos de espera en el origen puede solicitarse un cargo de 50 % con máximo de $5.000 CLP. Una vez aprobado, el 50 % corresponde al conductor y el 50 % a RAPA GO.

Los cargos están sujetos a evidencia y revisión administrativa. No corresponden cuando exista diferencia de identidad o vehículo, riesgo de seguridad, duplicidad o incumplimiento imputable al conductor o a la plataforma.$doc2$::text,
          '2026-07-23'::text
        ),
        (
          'privacy_policy'::text,
          '2.1'::text,
          'Política de Privacidad'::text,
          $doc3$RAPA GO — Política de Privacidad
Responsable: Haka Taiko SpA.
Versión 2.1. Vigente desde el 23 de julio de 2026.

1. Infraestructura
La API de producción se ejecuta en infraestructura Hostinger bajo backend.rapago.cl. La base de datos PostgreSQL es administrada mediante Supabase y se encuentra configurada en la región de São Paulo, Brasil. Los proveedores, respaldos, registros y accesos administrativos se controlan mediante el registro interno de infraestructura y subprocesadores.

2. Datos
RAPA GO puede tratar identificación y contacto; acreditaciones; datos del conductor y vehículo; ubicación durante funciones operativas; viajes y reservas; pagos y beneficios; soporte; calificaciones; incidentes; información técnica, sesiones, IP y auditorías de seguridad.

3. Ubicación
La ubicación se utiliza para solicitar, asignar, ejecutar y supervisar viajes. El seguimiento en segundo plano se activa únicamente cuando una función operativa lo requiere y debe detenerse al finalizar o cancelar el servicio.

4. Proveedores
Se utilizan, según la función habilitada, Hostinger, Supabase/PostgreSQL, Google Maps, Mercado Pago, Apple, Meta/Facebook, correo y notificaciones. RAPA GO no vende datos personales.

5. Conservación
Las ubicaciones GPS detalladas se conservan por hasta 90 días.
Los registros básicos de viajes, incidentes y reclamos pueden conservarse por hasta 5 años.
Los pagos, conciliaciones y documentos tributarios se conservan por 6 años o por el período superior que una norma obligatoria exija.
Los registros de seguridad e IP se conservan por hasta 12 meses, salvo investigación activa.
El soporte ordinario se conserva por hasta 24 meses desde el cierre.
Los certificados o adjuntos bancarios de reembolso deben eliminarse dentro de 30 días desde la finalización del reembolso, conservando solo el comprobante mínimo.
Las copias de seguridad siguen el ciclo documentado del proveedor y no deben utilizarse para reactivar una cuenta eliminada.
Cuando exista litigio, fraude, contracargo, accidente u obligación legal, los datos estrictamente necesarios pueden quedar bajo conservación restringida hasta el cierre del caso.

6. Eliminación
El motivo de la solicitud es opcional. El plazo comienza con la verificación de identidad. Se revocan sesiones y, cuando corresponda, la autorización de Sign in with Apple; luego se eliminan o anonimizan credenciales, perfiles, documentos y datos privados que no deban conservarse. La solicitud pública está disponible en https://api.rapago.cl/eliminar-cuenta.

7. Derechos y contacto
Las solicitudes de privacidad pueden realizarse en privacidad@rapago.cl o https://api.rapago.cl/soporte.$doc3$::text,
          '2026-07-23'::text
        )
    ) AS desired(type, version, title, content, effective_date)
  LOOP
    UPDATE public.legal_documents
    SET is_active = false, updated_at = now()
    WHERE type = document_record.type
      AND is_active = true;

    selected_document_id := NULL;

    SELECT id
    INTO selected_document_id
    FROM public.legal_documents
    WHERE type = document_record.type
      AND version = document_record.version
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF selected_document_id IS NULL THEN
      INSERT INTO public.legal_documents (
        type,
        version,
        title,
        content,
        effective_date,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        document_record.type,
        document_record.version,
        document_record.title,
        document_record.content,
        document_record.effective_date,
        true,
        now(),
        now()
      );
    ELSE
      UPDATE public.legal_documents
      SET
        title = document_record.title,
        content = document_record.content,
        effective_date = document_record.effective_date,
        is_active = true,
        updated_at = now()
      WHERE id = selected_document_id;
    END IF;
  END LOOP;
END
$legal$;

COMMIT;
