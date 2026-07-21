-- Reparación idempotente de documentos legales definitivos v2.0.
-- Corrige ambientes donde 0038 quedó registrada antes de activar todos los documentos.

DO $repair$
DECLARE
  document_record record;
  selected_document_id uuid;
BEGIN
  FOR document_record IN
    SELECT *
    FROM (
      VALUES
        (
          'intellectual_property'::text,
          '2.0'::text,
          'Propiedad Intelectual'::text,
          'La marca RAPA GO, sus interfaces, textos, logotipos, bases de datos, diseños y software están protegidos por la legislación aplicable. El uso de la aplicación no transfiere derechos de propiedad. Se permite únicamente el uso personal y legítimo del servicio. Está prohibido copiar, descompilar, extraer datos de forma masiva, eludir medidas de seguridad o utilizar la marca sin autorización escrita, salvo los derechos que la ley no permita restringir.'::text,
          '2026-07-21'::text
        ),
        (
          'software_license'::text,
          '2.0'::text,
          'Licencia de Software'::text,
          'RAPA GO concede una licencia limitada, revocable, no exclusiva, no transferible y personal para instalar y usar la aplicación con el fin de acceder a sus servicios. No se autoriza vender, sublicenciar, modificar, distribuir, realizar ingeniería inversa, automatizar accesos abusivos ni interferir con la seguridad. La licencia termina cuando se elimina la cuenta, se desinstala la aplicación o se incumplen estas condiciones, sin perjuicio de derechos legales obligatorios.'::text,
          '2026-07-21'::text
        ),
        (
          'data_providers'::text,
          '2.0'::text,
          'Proveedores de Datos y Servicios'::text,
          'RAPA GO utiliza proveedores estrictamente necesarios: Google Maps para mapas, rutas y geocodificación; Mercado Pago para pagos con tarjeta, conciliación y devoluciones al medio original; Meta y Facebook para autenticación cuando el usuario la selecciona; Hostinger para despliegue; Supabase y PostgreSQL para base de datos; y un proveedor SMTP para correos operativos. Cada proveedor recibe únicamente las categorías de datos necesarias para su función y se encuentra sujeto a sus propias condiciones y medidas de seguridad. Google Login no forma parte del lanzamiento actual.'::text,
          '2026-07-21'::text
        ),
        (
          'driver_conditions'::text,
          '2.0'::text,
          'Condiciones para Conductores'::text,
          'El conductor debe mantener licencia, identidad, vehículo y documentos vigentes; utilizar únicamente el vehículo registrado o autorizado; aceptar viajes que pueda cumplir; mantener ubicación activa solo durante servicios operativos; respetar el punto confirmado; registrar de forma veraz la llegada, inicio, finalización y el dinero recibido en efectivo; no cobrar montos distintos de los informados; proteger datos del pasajero; y reportar incidentes de seguridad. Los pagos de más y No Show están sujetos a revisión administrativa.'::text,
          '2026-07-21'::text
        ),
        (
          'guide_conditions'::text,
          '2.0'::text,
          'Condiciones para Guías'::text,
          'Los guías y prestadores turísticos deben publicar información verdadera, cumplir permisos aplicables, informar precios y condiciones antes de la reserva, proteger a los participantes, respetar horarios, mantener canales de contacto y no utilizar datos del usuario fuera de la prestación contratada. Las cancelaciones, devoluciones y reclamos deben quedar registrados en la plataforma o en sus canales oficiales.'::text,
          '2026-07-21'::text
        ),
        (
          'event_conditions'::text,
          '2.0'::text,
          'Condiciones para Eventos'::text,
          'La compra o reserva de eventos está sujeta a disponibilidad, precio, fecha, lugar, restricciones de edad o acceso y política de cancelación informada antes del pago. El organizador es responsable de la ejecución del evento y RAPA GO gestiona la intermediación y soporte según corresponda. Los comprobantes deben conservar un identificador verificable y los reembolsos se procesan conforme al medio de pago y la causa aceptada.'::text,
          '2026-07-21'::text
        )
    ) AS desired(type, version, title, content, effective_date)
  LOOP
    UPDATE legal_documents
    SET
      is_active = false,
      updated_at = NOW()
    WHERE type = document_record.type
      AND is_active = true;

    selected_document_id := NULL;

    SELECT id
    INTO selected_document_id
    FROM legal_documents
    WHERE type = document_record.type
      AND version = document_record.version
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF selected_document_id IS NULL THEN
      INSERT INTO legal_documents (
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
        NOW(),
        NOW()
      );
    ELSE
      UPDATE legal_documents
      SET
        title = document_record.title,
        content = document_record.content,
        effective_date = document_record.effective_date,
        is_active = true,
        updated_at = NOW()
      WHERE id = selected_document_id;
    END IF;
  END LOOP;
END
$repair$;

CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_active_type_uidx
  ON legal_documents(type)
  WHERE is_active = true;