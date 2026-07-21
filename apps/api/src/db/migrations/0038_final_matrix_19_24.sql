-- RAPA GO cierre final de matriz: puntos 19 al 24.

-- 19: ubicación previa efímera (la regla se aplica en frontend y se documenta en privacidad).
-- 20-21: documentos legales definitivos, versionados y sin textos de preparación.
UPDATE legal_documents
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND (
    lower(content) LIKE '%documento está en preparación%'
    OR lower(content) LIKE '%documento esta en preparacion%'
    OR length(trim(content)) < 80
  );

UPDATE legal_documents SET is_active = false, updated_at = NOW()
WHERE type IN ('terms_and_conditions','privacy_policy','user_conditions','intellectual_property','software_license','data_providers','driver_conditions','guide_conditions','event_conditions') AND is_active = true;

INSERT INTO legal_documents (type, version, title, content, effective_date, is_active) VALUES
('terms_and_conditions', '2.0', 'Términos y Condiciones', '1. Objeto. RAPA GO conecta a usuarios con conductores y otros prestadores independientes en Rapa Nui. La plataforma no garantiza disponibilidad permanente ni reemplaza servicios de emergencia.

2. Cuenta. El usuario debe entregar información verdadera, proteger sus credenciales y mantener actualizados sus datos. No puede suplantar a terceros ni crear cuentas para evadir controles.

3. Viajes. Antes de confirmar se informa origen, destino, categoría, tarifa estimada y medio de pago. La tarifa final puede incorporar únicamente ajustes informados y autorizados por las reglas vigentes.

4. Cancelaciones y No Show. Rigen las políticas visibles en la aplicación: cancelación gratuita durante los primeros dos minutos desde la aceptación; luego 30% con tope de $3.000, salvo causales de seguridad o responsabilidad de la plataforma. No Show después de cinco minutos desde la llegada: 50% con tope de $5.000, sujeto a revisión administrativa.

5. Pagos. Los pagos con tarjeta se procesan mediante Mercado Pago. En efectivo, el conductor registra el monto recibido. Un pago de más puede convertirse, a elección del usuario y con revisión administrativa, en beneficio para el próximo viaje o devolución bancaria.

6. Conducta y seguridad. Se prohíben amenazas, discriminación, acoso, fraude, transporte de objetos ilícitos y cualquier uso que ponga en riesgo a personas o bienes.

7. Privacidad. El tratamiento de datos se rige por la Política de Privacidad vigente y por los permisos otorgados en el dispositivo.

8. Soporte y reclamos. Los canales oficiales son el Centro de Ayuda, soporte@rapago.cl y el WhatsApp institucional informado en la aplicación.

9. Cambios. Las nuevas versiones se publican con fecha de vigencia. Cuando el cambio sea material, se solicitará una nueva aceptación.

10. Ley aplicable. Estas condiciones se interpretan conforme a la legislación chilena, sin limitar derechos irrenunciables del consumidor.', '2026-07-21', true),
('privacy_policy', '2.0', 'Política de Privacidad', 'RAPA GO trata los datos necesarios para crear y proteger cuentas, gestionar viajes, pagos, soporte y obligaciones legales.

Datos tratados: identificación y contacto; categoría tarifaria y documentos de verificación cuando corresponda; ubicación solicitada por el usuario; origen, destino y trazabilidad durante un viaje activo; información del vehículo y conductor; pagos y conciliación; soporte, comentarios privados y auditoría.

Ubicación previa: al tocar “usar mi ubicación”, el dato exacto se mantiene temporalmente en el dispositivo para centrar el selector. No se transmite al backend mientras no se confirme una solicitud. Al cancelar, abandonar la pantalla, vencer el plazo temporal o crear el viaje, esa ubicación previa se elimina. El viaje guarda únicamente el punto de recogida accesible confirmado.

Proveedores: Google Maps para mapas y geocodificación; Mercado Pago para pagos con tarjeta; Meta/Facebook cuando el usuario elige ese acceso; Hostinger y Supabase/PostgreSQL para infraestructura; proveedor SMTP para correos operativos.

Conservación: los datos se guardan por el tiempo necesario para prestar el servicio, resolver reclamos, prevenir fraude y cumplir obligaciones legales. Los datos temporales del dispositivo se eliminan al cerrar sesión o al terminar su finalidad.

Derechos: el titular puede solicitar acceso, corrección, eliminación o información mediante privacidad@rapago.cl o la página pública de eliminación. Las solicitudes pueden aplazarse solo por causas justificadas y dentro del plazo informado.

Seguridad: se aplican controles de acceso por rol, cifrado de datos bancarios, registro de auditoría y revocación de sesiones. Ningún sistema es infalible; los incidentes se gestionan según su impacto y la normativa aplicable.', '2026-07-21', true),
('user_conditions', '2.0', 'Condiciones para Usuarios', 'Estas condiciones complementan, y no sustituyen, los Términos y Condiciones generales.

1. Solicitudes. El usuario debe confirmar un origen accesible, un destino real, el tipo de servicio y el medio de pago. No debe solicitar viajes ficticios ni para terceros sin autorización.

2. Identidad y categoría. La cuenta y la categoría tarifaria deben corresponder al usuario que utiliza el servicio. La condición de residente Rapa Nui queda sujeta a verificación documental; mientras está pendiente o rechazada se aplica la tarifa chilena.

3. Recogida. El usuario debe encontrarse en el punto confirmado, atender las comunicaciones operativas y presentarse dentro de cinco minutos desde la llegada del conductor.

4. Seguridad. Puede cancelar sin cargo ante discrepancias de identidad o vehículo, riesgo de seguridad, duplicidad de plataforma u otra causa atribuible al operador o conductor. Debe informar el motivo de buena fe.

5. Pagos. En efectivo, debe revisar el monto informado por el conductor. Si pagó de más, puede elegir una sola resolución: beneficio para el próximo viaje de la misma cuenta o devolución bancaria.

6. Comentarios. La calificación numérica puede contribuir al promedio. El usuario elige si el comentario es visible para las partes y administración o exclusivamente para RAPA GO. Los comentarios privados no se publican.

7. Uso responsable. Se prohíben agresiones, discriminación, daños, fraude, manipulación de GPS o pagos, y cualquier conducta ilícita.

8. Soporte. Los reclamos deben incluir información suficiente y veraz. RAPA GO puede conservar evidencia limitada para investigar seguridad, pagos o cumplimiento.', '2026-07-21', true),
('intellectual_property', '2.0', 'Propiedad Intelectual', 'La marca RAPA GO, sus interfaces, textos, logotipos, bases de datos, diseños y software están protegidos por la legislación aplicable. El uso de la aplicación no transfiere derechos de propiedad. Se permite únicamente el uso personal y legítimo del servicio. Está prohibido copiar, descompilar, extraer datos de forma masiva, eludir medidas de seguridad o utilizar la marca sin autorización escrita, salvo los derechos que la ley no permita restringir.', '2026-07-21', true),
('software_license', '2.0', 'Licencia de Software', 'RAPA GO concede una licencia limitada, revocable, no exclusiva, no transferible y personal para instalar y usar la aplicación con el fin de acceder a sus servicios. No se autoriza vender, sublicenciar, modificar, distribuir, realizar ingeniería inversa, automatizar accesos abusivos ni interferir con la seguridad. La licencia termina cuando se elimina la cuenta, se desinstala la aplicación o se incumplen estas condiciones, sin perjuicio de derechos legales obligatorios.', '2026-07-21', true),
('data_providers', '2.0', 'Proveedores de Datos y Servicios', 'RAPA GO utiliza proveedores estrictamente necesarios: Google Maps para mapas, rutas y geocodificación; Mercado Pago para pagos con tarjeta, conciliación y devoluciones al medio original; Meta/Facebook para autenticación cuando el usuario la selecciona; Hostinger para despliegue; Supabase/PostgreSQL para base de datos; y un proveedor SMTP para correos operativos. Cada proveedor recibe únicamente las categorías de datos necesarias para su función y se encuentra sujeto a sus propias condiciones y medidas de seguridad. Google Login no forma parte del lanzamiento actual.', '2026-07-21', true),
('driver_conditions', '2.0', 'Condiciones para Conductores', 'El conductor debe mantener licencia, identidad, vehículo y documentos vigentes; utilizar únicamente el vehículo registrado o autorizado; aceptar viajes que pueda cumplir; mantener ubicación activa solo durante servicios operativos; respetar el punto confirmado; registrar de forma veraz la llegada, inicio, finalización y el dinero recibido en efectivo; no cobrar montos distintos de los informados; proteger datos del pasajero; y reportar incidentes de seguridad. Los pagos de más y No Show están sujetos a revisión administrativa.', '2026-07-21', true),
('guide_conditions', '2.0', 'Condiciones para Guías', 'Los guías y prestadores turísticos deben publicar información verdadera, cumplir permisos aplicables, informar precios y condiciones antes de la reserva, proteger a los participantes, respetar horarios, mantener canales de contacto y no utilizar datos del usuario fuera de la prestación contratada. Las cancelaciones, devoluciones y reclamos deben quedar registrados en la plataforma o en sus canales oficiales.', '2026-07-21', true),
('event_conditions', '2.0', 'Condiciones para Eventos', 'La compra o reserva de eventos está sujeta a disponibilidad, precio, fecha, lugar, restricciones de edad o acceso y política de cancelación informada antes del pago. El organizador es responsable de la ejecución del evento y RAPA GO gestiona la intermediación y soporte según corresponda. Los comprobantes deben conservar un identificador verificable y los reembolsos se procesan conforme al medio de pago y la causa aceptada.', '2026-07-21', true)
ON CONFLICT DO NOTHING;

-- Una sola versión activa por tipo.
CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_active_type_uidx
  ON legal_documents(type) WHERE is_active = true;

-- 22: privacidad y moderación de comentarios.
ALTER TABLE ride_ratings
  ADD COLUMN IF NOT EXISTS comment_visibility varchar(32) NOT NULL DEFAULT 'participants_and_admin',
  ADD COLUMN IF NOT EXISTS moderation_status varchar(24) NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS ride_ratings_moderation_idx
  ON ride_ratings(moderation_status, created_at);

DO $$ BEGIN
  ALTER TABLE ride_ratings ADD CONSTRAINT ride_ratings_comment_visibility_check
    CHECK (comment_visibility IN ('participants_and_admin', 'admin_only'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ride_ratings ADD CONSTRAINT ride_ratings_moderation_status_check
    CHECK (moderation_status IN ('visible', 'hidden'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 23: idempotencia y trazabilidad de webhooks de pago.
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(32) NOT NULL,
  event_key varchar(128) NOT NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  provider_payment_id varchar(160),
  request_id varchar(160),
  action varchar(100),
  payload_hash varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'processing',
  error_message text,
  received_at timestamp with time zone NOT NULL DEFAULT NOW(),
  processed_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_key_uidx
  ON payment_webhook_events(provider, event_key);
CREATE INDEX IF NOT EXISTS payment_webhook_events_payment_idx
  ON payment_webhook_events(payment_id, received_at);
CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx
  ON payment_webhook_events(status, received_at);

-- 24: cierre de efectivo en backend como fuente de verdad.
CREATE TABLE IF NOT EXISTS cash_payment_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id) ON DELETE RESTRICT,
  passenger_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  driver_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  fare_clp integer NOT NULL,
  paid_clp integer NOT NULL,
  overpaid_clp integer NOT NULL DEFAULT 0,
  decision varchar(24) NOT NULL,
  status varchar(40) NOT NULL,
  resolution_type varchar(24),
  resolution_reference_id uuid,
  driver_note text,
  closed_at timestamp with time zone NOT NULL DEFAULT NOW(),
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_payment_closures_amounts_check CHECK (
    fare_clp > 0 AND paid_clp >= fare_clp AND overpaid_clp = paid_clp - fare_clp
  ),
  CONSTRAINT cash_payment_closures_decision_check CHECK (
    decision IN ('exact', 'overpaid')
  ),
  CONSTRAINT cash_payment_closures_resolution_check CHECK (
    resolution_type IS NULL OR resolution_type IN ('benefit', 'bank_refund')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_payment_closures_ride_uidx
  ON cash_payment_closures(ride_request_id);
CREATE INDEX IF NOT EXISTS cash_payment_closures_passenger_idx
  ON cash_payment_closures(passenger_user_id, closed_at);
CREATE INDEX IF NOT EXISTS cash_payment_closures_driver_idx
  ON cash_payment_closures(driver_user_id, closed_at);
CREATE INDEX IF NOT EXISTS cash_payment_closures_status_idx
  ON cash_payment_closures(status, closed_at);
