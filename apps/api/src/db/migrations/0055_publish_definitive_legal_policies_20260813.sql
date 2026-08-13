-- RAPA GO - Politicas legales definitivas 13-08-2026
-- Fuente: documentos finales aprobados por el equipo RAPA GO.
--
-- Publica una sola version activa por tipo, conserva el historial y las
-- aceptaciones anteriores. Si ya existe exactamente el mismo contenido,
-- reutiliza esa fila; si el contenido de una version homonima es distinto,
-- crea una nueva fila para conservar trazabilidad documental.
--
-- Versiones objetivo:
-- - terms_and_conditions 4.0
-- - user_conditions 1.1
-- - privacy_policy 1.0
-- - driver_conditions 2.1

BEGIN;

DO $publish_rapago_terms_v4$
DECLARE
  target_id uuid;
BEGIN
  SELECT id
  INTO target_id
  FROM legal_documents
  WHERE type = 'terms_and_conditions'
    AND version = '4.0'
    AND content = $rapago_terms_v4$RAPA GO

TÉRMINOS Y CONDICIONES GENERALES DE USO

Aplicación móvil de intermediación de servicios de movilidad en Rapa Nui

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 4.0

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Documento contractual aplicable a usuarios y pasajeros. Las condiciones de los conductores se regulan en un contrato separado. La versión publicada en api.rapago.cl/terminos debe coincidir exactamente con la aceptada dentro de la App.

INFORMACIÓN ESENCIAL Rapa Go es una marca operada por Haka Taiko SpA. La App permite solicitar y coordinar servicios de movilidad prestados por conductores independientes habilitados. La creación de una cuenta y la contratación de un servicio requieren aceptación expresa de estos Términos, de las Condiciones de Usuarios como anexo subordinado y conocimiento/aceptación de la Política de Privacidad.

1. Identificación del operador y ámbito de aplicación

La aplicación móvil Rapa Go y los servicios asociados a dicha marca son operados y administrados por Haka Taiko SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, comuna y territorio especial de Isla de Pascua, Región de Valparaíso, Chile, en adelante ‘Rapa Go’, el ‘Operador’ o la ‘Plataforma’.

Estos Términos regulan el registro, acceso, solicitud, reserva, pago y uso de servicios de movilidad en Rapa Nui por usuarios y pasajeros. No regulan la relación entre Rapa Go y los conductores, quienes deberán aceptar un contrato específico antes de ser habilitados.

2. Jerarquía contractual y documentos complementarios

Forman parte del marco contractual: estos Términos Generales; las Condiciones de Usuarios; la Política de Privacidad; los permisos y divulgaciones contextuales de geolocalización; las reglas de tarifas, cancelación y reembolso mostradas en la App; y las condiciones particulares de una reserva, campaña o promoción.

Las Condiciones de Usuarios constituyen un anexo operativo subordinado. En caso de contradicción prevalecerán estos Términos Generales y, a continuación, la condición particular informada y aceptada para el servicio específico, siempre dentro de la legislación aplicable.

3. Definiciones

• App o Aplicación: software móvil Rapa Go y sus servicios asociados.

• Usuario: persona natural que crea una cuenta, solicita, reserva, paga o administra un servicio.

• Pasajero: persona que utiliza materialmente el servicio, sea o no quien lo solicitó.

• Conductor: prestador independiente habilitado que acepta y ejecuta el servicio.

• Servicio: traslado solicitado, reservado, asignado y registrado mediante la App.

• Tarifa: precio total mostrado al usuario antes de confirmar, incluidos cargos aplicables.

• Beneficio o saldo: monto registrado a favor del usuario por pago en exceso, ajuste, devolución o promoción; no constituye cuenta bancaria ni billetera digital.

• Proveedor de pagos: Itaú Klap, utilizado para procesar autorizaciones, capturas, liberaciones y demás operaciones electrónicas habilitadas.

4. Aceptación, capacidad y vigencia

El usuario deberá ser mayor de dieciocho años y contar con capacidad legal suficiente. La aceptación se realizará mediante una acción afirmativa y quedará registrada con usuario, documento, versión, fecha y hora.

Las casillas obligatorias no estarán preseleccionadas. Los consentimientos opcionales se solicitarán separadamente. Las modificaciones materiales requerirán nueva aceptación antes de continuar utilizando funciones reguladas.

5. Registro, autenticación y seguridad de la cuenta

El registro es obligatorio. El usuario deberá proporcionar los datos necesarios para identidad, contacto, categoría, seguridad, pagos y cumplimiento, incluyendo nombre, RUT o pasaporte, correo electrónico, teléfono y los demás antecedentes que la App identifique como obligatorios. La fotografía del pasajero será opcional.

La cuenta podrá crearse o autenticarse mediante correo electrónico y contraseña, Google y, en iOS, Sign in with Apple. Facebook no forma parte de la versión de lanzamiento. Las identidades se vincularán a una única cuenta y no se fusionarán automáticamente por la sola coincidencia de correo.

Quien ingrese mediante Google o Apple podrá configurar una contraseña Rapa Go de respaldo mediante verificación de correo. El usuario deberá proteger sus credenciales y reportar accesos no autorizados.

6. Categorías de usuario, residencia y visitantes

La App podrá distinguir entre ‘RAPA NUI / RESIDENTE RAPA NUI’, visitante chileno y visitante extranjero. Para efectos de la categoría de residente, la expresión se refiere exclusivamente a residencia territorial habilitada y acreditada y no constituye declaración ni certificación de pertenencia étnica.

Rapa Go podrá aplicar tarifas distintas entre las categorías de visitante chileno y visitante extranjero. En todos los casos, el precio total aplicable a la categoría declarada y/o verificada será informado antes de confirmar el servicio.

El usuario deberá proporcionar antecedentes veraces y, cuando corresponda, acreditar residencia. La información falsa o inconsistente podrá dar lugar a recategorización, cobro de diferencias, advertencia, suspensión o bloqueo en casos graves o reiterados.

7. Naturaleza y objeto de Rapa Go

Rapa Go proporciona infraestructura tecnológica para coordinar el contacto entre usuarios y conductores independientes; informa tarifas, administra reglas operativas, registra viajes, procesa o coordina pagos y brinda soporte.

El conductor decide libremente si acepta una oferta. La publicación de una solicitud no garantiza aceptación ni tiempo exacto de llegada. Lo anterior no limita las responsabilidades legales propias del Operador por sus actos, sistemas, información, cobros u obligaciones frente a consumidores.

8. Solicitud, autorización de pago y asignación

Antes de confirmar, el usuario indicará origen, destino, categoría y medio de pago. Cuando se utilice pago electrónico, al enviar la solicitud o reserva Itaú Klap podrá efectuar una autorización o retención por hasta el monto total informado, sin que ello implique por sí solo un cobro definitivo.

La App buscará y asignará la solicitud a un conductor por vez mediante criterios objetivos como proximidad, disponibilidad, categoría y capacidad. Se considerará efectivamente asignado un conductor cuando la aceptación sea registrada por el sistema y dicha asignación sea confirmada al usuario.

Si no se logra designar conductor, la autorización o retención deberá liberarse íntegramente y no procederá captura por el viaje no ejecutado.

9. Información del conductor y vehículo

Antes del inicio, la App mostrará, según disponibilidad técnica, nombre y fotografía del conductor, calificación, marca, modelo, color, patente y ubicación aproximada. El usuario deberá verificar coincidencia y abstenerse de abordar ante una discrepancia relevante, reportándola a Rapa Go.

10. Categorías, equipaje y servicios no disponibles

Las categorías iniciales podrán incluir Estándar, XL, Maletas y Express o Prioritario. Express podrá mostrarse cuando la asignación ordinaria tarde más de lo esperado. Confort, Encomiendas, Tours, Rent a Car, Eventos y otras funciones futuras no se entenderán ofrecidas mientras no estén habilitadas y sujetas a condiciones específicas.

Los objetos voluminosos deberán solicitarse en categoría compatible. No se permite transportar pasajeros en pick-up o espacios no habilitados. En el lanzamiento no se aceptan mascotas ni viajes multidestino o paradas adicionales.

11. Tarifas dinámicas, precio y redondeo

Las tarifas pueden considerar distancia, categoría, demanda, disponibilidad, residencia o categoría de visitante, reserva, modalidad Express, promociones y condiciones operativas. El precio total mostrado antes de confirmar incorporará el redondeo que corresponda, incluido el redondeo a múltiplos de $500 cuando esté configurado.

El precio será cerrado, salvo error manifiesto, modificación autorizada por el usuario, contingencia de seguridad, corte de camino, instrucción de autoridad, fuerza mayor u otra circunstancia objetivamente verificable. La App no permite agregar paradas o destinos después de confirmar.

12. Pagos electrónicos, captura y documentación tributaria

Los servicios podrán pagarse mediante Itaú Klap y, cuando se ofrezca expresamente, en efectivo. Rapa Go no conserva números completos de tarjetas ni códigos de seguridad.

Si el servicio se ejecuta íntegramente, se capturará el monto total autorizado conforme al precio contratado. Si corresponde un cargo de cancelación o no show, se capturará únicamente el monto aplicable y se liberará el saldo restante de la autorización. Si no corresponde cobro, la autorización será liberada íntegramente.

El comprobante de Itaú Klap acredita el procesamiento de la operación y no reemplaza el documento tributario que corresponda. Haka Taiko SpA emitirá la boleta o factura aplicable y la enviará al correo registrado conforme al flujo tributario vigente. Para solicitar factura deberán proporcionarse los datos tributarios necesarios.

13. Beneficios, saldos y reembolsos

Los beneficios o saldos podrán originarse por pagos en exceso, ajustes, devoluciones o promociones. No pueden cargarse voluntariamente, transferirse entre usuarios ni retirarse directamente desde la App.

Un saldo reembolsable podrá utilizarse en servicios posteriores o solicitarse en devolución mediante Centro de Ayuda o pagos@rapago.cl. Rapa Go verificará la titularidad bancaria y tramitará la devolución en plazos razonables conforme a su procedimiento operativo.

Los créditos promocionales podrán sujetarse a condiciones propias y no necesariamente serán canjeables por dinero.

14. Cancelación del pasajero después de la asignación del conductor

Desde el momento en que un conductor queda efectivamente designado/asignado al viaje comienza a correr un plazo de un minuto, registrado por el sistema.

Si el pasajero cancela antes de cumplirse íntegramente un minuto desde la asignación confirmada, no existirá cobro y se liberará completamente la autorización o retención asociada al servicio.

Si el pasajero cancela una vez transcurrido un minuto desde la asignación confirmada, se aplicará un cargo equivalente al treinta por ciento de la tarifa total del servicio, con un tope máximo de $3.000. El cargo será, por tanto, el menor valor entre el 30% de la tarifa y $3.000.

No procederá el cargo cuando exista discrepancia relevante del conductor o vehículo, riesgo de seguridad, error de la Plataforma, duplicidad, cancelación imputable al conductor u otra causa objetiva aceptada por Rapa Go.

15. Ausencia de conductor y cancelación atribuible al conductor

Si no se designa conductor, no se realizará cobro y se liberará íntegramente la autorización. Si un conductor ya asignado cancela, no se cargará al pasajero por dicha cancelación y la Plataforma podrá iniciar un proceso de reasignación, sujeto a disponibilidad.

16. Reservas programadas

En las reservas programadas, la cancelación será gratuita hasta treinta minutos antes del horario reservado. Dentro de los treinta minutos previos podrá aplicarse un cargo equivalente al 30% de la tarifa total, con tope de $3.000, salvo causa justificada o incumplimiento imputable a Rapa Go o al conductor.

17. No presentación del pasajero (No Show)

Si el conductor registra su llegada al punto de retiro y el pasajero no se presenta dentro de cinco minutos, podrá aplicarse un cargo equivalente al cincuenta por ciento del valor total del viaje, con tope de $5.000.

El cargo requiere llegada verificable y tiempo de espera registrado. No procederá cuando exista error relevante de ubicación, imposibilidad de contacto imputable a la Plataforma, discrepancia del vehículo o conductor, riesgo de seguridad u otra causa objetiva aceptada por Rapa Go.

La distribución interna del cargo entre Rapa Go y el conductor no modifica el monto informado al usuario.

18. Obligaciones del usuario

• Proporcionar información verdadera y mantener datos y medios de contacto actualizados.

• Estar disponible en el punto de retiro y verificar conductor y vehículo.

• Usar cinturón de seguridad y cumplir instrucciones razonables de seguridad.

• No exceder capacidad; solicitar categoría compatible con equipaje; y proveer sistema de retención infantil cuando legalmente corresponda.

• Pagar tarifa y cargos válidamente informados.

• Tratar respetuosamente a conductores, personal y comunidad.

• No solicitar detenciones, rutas o conductas contrarias a la ley o seguridad.

19. Conductas prohibidas

• Fraude, suplantación, cuentas múltiples abusivas, contracargos infundados o manipulación de promociones.

• Agresión, amenaza, acoso, discriminación, daños o lenguaje ofensivo.

• Portar objetos ilícitos, peligrosos o incompatibles con transporte seguro.

• Solicitar servicios fuera de la App para eludir tarifas, trazabilidad o seguridad.

• Interferir con la App, geolocalización, pagos o sistemas de seguridad.

• Usar datos personales del conductor para fines distintos del viaje.

20. Seguridad, rechazo o término anticipado

El conductor podrá rechazar o terminar un servicio si existe riesgo, agresión, exceso de pasajeros, conducta ilícita, equipaje peligroso, condiciones inseguras, camino bloqueado o fuerza mayor. Cuando sea posible deberá detenerse en un lugar seguro. Rapa Go podrá investigar y adoptar medidas proporcionales.

21. Accidentes, incidentes y emergencias

Ante riesgo inmediato, el usuario deberá contactar directamente a los servicios públicos de emergencia. Los canales de Rapa Go permiten reportar y preservar antecedentes, pero no reemplazan a Carabineros, servicios de salud, Bomberos ni autoridades competentes.

Rapa Go podrá solicitar ubicación, fotografías, relato, identificación del viaje y documentos; podrá suspender preventivamente cuentas o vehículos mientras verifica un incidente grave y colaborará con requerimientos formales de autoridad.

22. Responsabilidad y derechos del consumidor

El conductor responde por la conducción y ejecución material del servicio. Rapa Go responde por sus propios actos u omisiones, administración de la Plataforma, información, sistemas y obligaciones legales.

Rapa Go no garantiza disponibilidad permanente, tiempo exacto de llegada ni funcionamiento ininterrumpido en condiciones de baja conectividad, GPS deficiente, clima, caminos, fallas de terceros o fuerza mayor.

Ninguna cláusula excluye derechos irrenunciables del consumidor, responsabilidad por dolo o culpa grave ni responsabilidades que la ley no permita limitar.

23. Objetos olvidados

El usuario deberá reportar el objeto mediante Centro de Ayuda, WhatsApp o reclamos@rapago.cl, indicando viaje, descripción y contacto. Rapa Go realizará gestiones razonables sin garantizar recuperación. Si el conductor debe efectuar un desplazamiento adicional, podrá aplicarse un cargo de gestión previamente informado.

24. Calificaciones y comentarios

El usuario podrá calificar al conductor. Los comentarios escritos serán privados y accesibles únicamente al personal autorizado de Administración, Soporte y Jurídica cuando exista necesidad funcional. El conductor verá su puntuación y métricas, no el texto privado, salvo que sea necesario comunicar antecedentes esenciales de una investigación resguardando datos de terceros.

25. Soporte y reclamos

Los canales oficiales para pasajeros son el Centro de Ayuda dentro de la App, soporte@rapago.cl, reclamos@rapago.cl, privacidad@rapago.cl y WhatsApp institucional +56 9 4796 4171.

La atención a pasajeros se prestará principalmente por medios digitales y remotos. La recepción de solicitudes puede ser automática. Rapa Go no garantiza atención humana inmediata, permanente ni presencial para pasajeros, y procurará responder de acuerdo con la naturaleza y complejidad del caso.

Los asuntos simples serán gestionados preferentemente dentro de tres días hábiles y los complejos dentro de cinco; las investigaciones podrán extenderse hasta diez días hábiles, prorrogables fundadamente.

26. Respeto al Pueblo Rapa Nui, cultura y patrimonio

La operación se desarrolla en un territorio de alto valor cultural, espiritual, histórico, arqueológico, comunitario y ambiental. Todos los usuarios deberán respetar al Pueblo Rapa Nui, su idioma, tradiciones, comunidades, sitios sagrados, patrimonio, propietarios y reglas de convivencia.

• Está prohibido ingresar o promover el ingreso a zonas arqueológicas, sagradas, privadas o restringidas sin autorización.

• Está prohibido tocar, remover, dañar, intervenir, profanar o alterar patrimonio cultural o natural.

• No se permiten burlas, discriminación ni conductas ofensivas.

• El servicio de movilidad no incluye entradas, permisos, accesos ni guiado turístico profesional.

• Un incumplimiento grave podrá originar bloqueo y, cuando corresponda, comunicación a la autoridad.

27. Privacidad y tratamiento de datos

El tratamiento se rige por la Política de Privacidad publicada en api.rapago.cl/privacidad. Haka Taiko SpA es responsable del tratamiento bajo la marca Rapa Go.

La infraestructura de producción incluye páginas y frontend en api.rapago.cl, API en backend.rapago.cl alojada en Hostinger, y PostgreSQL/Supabase en São Paulo, Brasil, además de los proveedores de autenticación, mapas, ubicación, pagos, correo y soporte descritos en la Política.

Rapa Go aplicará medidas de seguridad, accesos por roles, cifrado, auditoría, respaldos y conservación proporcional. La Política se adecuará a la legislación vigente y a la entrada en vigor de la Ley N.º 21.719 el 1 de diciembre de 2026.

28. Geolocalización

El pasajero compartirá ubicación cuando confirme el origen o envíe la solicitud. Puede ingresar manualmente origen y destino si rechaza el permiso de ubicación.

La ubicación del conductor antes del viaje se utilizará transitoriamente para disponibilidad y asignación; se conservará solo la última coordenada operativa por hasta quince minutos y no se generará una ruta previa. Durante un servicio activo, el conductor podrá transmitir ubicación en segundo plano cuando sea indispensable. El seguimiento finalizará al completar, cancelar, cerrar sesión o perder autorización, sin perjuicio de registros ya generados.

29. Eliminación de cuenta

El usuario podrá iniciar la eliminación desde la App y desde api.rapago.cl/eliminar-cuenta. El proceso exige verificación razonable de identidad y se completará dentro de treinta días desde la verificación, salvo aplazamiento objetivo.

La eliminación podrá aplazarse por viaje o reserva activa, saldo o devolución pendiente, reclamo, contracargo, investigación de fraude u obligación legal. La cuenta no se mantendrá activa por el solo hecho de conservar registros mínimos.

El motivo de eliminación será opcional y podrá seleccionarse ‘Prefiero no indicar’. La falta de motivo no impedirá el ejercicio. Solo podrá no procesarse una solicitud cuando no sea posible verificar identidad, corresponda a una cuenta inexistente o duplicada, o la solicitud ya haya sido ejecutada.

Cuando la cuenta use Sign in with Apple, Rapa Go revocará los tokens asociados mediante el procedimiento oficial de Apple al ejecutar la eliminación.

30. Propiedad intelectual, licencia y tiendas

Rapa Go, la App, interfaces, software, bases de datos, diseños, textos, gráficos y signos pertenecen al Operador o sus licenciantes. El usuario recibe una licencia personal, limitada, revocable, no exclusiva e intransferible para uso legítimo.

En dispositivos Apple, la licencia de la aplicación se complementa con la EULA estándar de Apple. Apple y Google no prestan el servicio de movilidad ni son parte del contrato entre el usuario y Rapa Go.

31. Proveedores y servicios de terceros

La App integra, según sistema operativo y versión, Google Sign-In, Sign in with Apple en iOS, Google Maps y servicios nativos de ubicación, Itaú Klap, Hostinger, Supabase, Gmail/SMTP y WhatsApp. Facebook Login, Firebase, Sentry, Google Analytics y Crashlytics no se encuentran activos en la versión de lanzamiento.

Cada proveedor puede estar sujeto a sus propios términos y políticas. Rapa Go procurará limitar los datos al mínimo necesario y reflejar el tratamiento en su Política de Privacidad y en las declaraciones de las tiendas.

32. Disponibilidad, actualizaciones y continuidad

Rapa Go podrá corregir, mejorar, suspender temporalmente o retirar funciones por mantenimiento, seguridad, cumplimiento o necesidades operativas. Los servicios coordinados completamente fuera de la App no disponen de su trazabilidad, soporte ni mecanismos de reclamo.

33. Módulos futuros

Rapa Go podrá incorporar Tours, Rent a Car, Eventos, Encomiendas, Publicidad u otros módulos. Cada uno tendrá condiciones específicas. Mientras no aparezca habilitado no se entenderá ofrecido ni contratado.

34. Modificaciones

Rapa Go podrá modificar estos Términos por cambios legales, regulatorios, tecnológicos, operativos o comerciales. Las modificaciones materiales se informarán y requerirán aceptación expresa. Se conservará historial de versiones.

35. Ley aplicable, domicilio y competencia

Estos Términos se rigen por las leyes de Chile. El Operador fija domicilio en Isla de Pascua para comunicaciones, sin perjuicio de los derechos irrenunciables del consumidor y de las reglas legales de competencia. El usuario podrá recurrir a Rapa Go, al Servicio Nacional del Consumidor y a los tribunales o autoridades que determine la ley.

36. Idioma, vigencia y contacto

Los Términos podrán ofrecerse en español e inglés. En caso de discrepancia interpretativa prevalecerá el español, sin afectar derechos legales. La versión 4.0 entra en vigor desde su publicación y aceptación electrónica.

Materia | Canal oficial

Soporte general | Centro de Ayuda · soporte@rapago.cl · WhatsApp +56 9 4796 4171

Reclamos | reclamos@rapago.cl

Privacidad y eliminación | privacidad@rapago.cl · api.rapago.cl/eliminar-cuenta

Pagos y reembolsos | pagos@rapago.cl

Facturación | contabilidad@rapago.cl

Comunicaciones legales | legal@rapago.cl

Domicilio | Miru s/n, Isla de Pascua, Chile

ACEPTACIÓN Al seleccionar “Acepto”, el usuario declara haber leído y comprendido estos Términos y acepta quedar obligado por ellos, por las Condiciones de Usuarios y por las reglas específicas mostradas antes de contratar.
$rapago_terms_v4$
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF target_id IS NULL THEN
    INSERT INTO legal_documents (
      type, version, title, content, effective_date, is_active, created_at, updated_at
    )
    VALUES (
      'terms_and_conditions',
      '4.0',
      'Términos y Condiciones Generales de Uso',
      $rapago_terms_v4$RAPA GO

TÉRMINOS Y CONDICIONES GENERALES DE USO

Aplicación móvil de intermediación de servicios de movilidad en Rapa Nui

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 4.0

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Documento contractual aplicable a usuarios y pasajeros. Las condiciones de los conductores se regulan en un contrato separado. La versión publicada en api.rapago.cl/terminos debe coincidir exactamente con la aceptada dentro de la App.

INFORMACIÓN ESENCIAL Rapa Go es una marca operada por Haka Taiko SpA. La App permite solicitar y coordinar servicios de movilidad prestados por conductores independientes habilitados. La creación de una cuenta y la contratación de un servicio requieren aceptación expresa de estos Términos, de las Condiciones de Usuarios como anexo subordinado y conocimiento/aceptación de la Política de Privacidad.

1. Identificación del operador y ámbito de aplicación

La aplicación móvil Rapa Go y los servicios asociados a dicha marca son operados y administrados por Haka Taiko SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, comuna y territorio especial de Isla de Pascua, Región de Valparaíso, Chile, en adelante ‘Rapa Go’, el ‘Operador’ o la ‘Plataforma’.

Estos Términos regulan el registro, acceso, solicitud, reserva, pago y uso de servicios de movilidad en Rapa Nui por usuarios y pasajeros. No regulan la relación entre Rapa Go y los conductores, quienes deberán aceptar un contrato específico antes de ser habilitados.

2. Jerarquía contractual y documentos complementarios

Forman parte del marco contractual: estos Términos Generales; las Condiciones de Usuarios; la Política de Privacidad; los permisos y divulgaciones contextuales de geolocalización; las reglas de tarifas, cancelación y reembolso mostradas en la App; y las condiciones particulares de una reserva, campaña o promoción.

Las Condiciones de Usuarios constituyen un anexo operativo subordinado. En caso de contradicción prevalecerán estos Términos Generales y, a continuación, la condición particular informada y aceptada para el servicio específico, siempre dentro de la legislación aplicable.

3. Definiciones

• App o Aplicación: software móvil Rapa Go y sus servicios asociados.

• Usuario: persona natural que crea una cuenta, solicita, reserva, paga o administra un servicio.

• Pasajero: persona que utiliza materialmente el servicio, sea o no quien lo solicitó.

• Conductor: prestador independiente habilitado que acepta y ejecuta el servicio.

• Servicio: traslado solicitado, reservado, asignado y registrado mediante la App.

• Tarifa: precio total mostrado al usuario antes de confirmar, incluidos cargos aplicables.

• Beneficio o saldo: monto registrado a favor del usuario por pago en exceso, ajuste, devolución o promoción; no constituye cuenta bancaria ni billetera digital.

• Proveedor de pagos: Itaú Klap, utilizado para procesar autorizaciones, capturas, liberaciones y demás operaciones electrónicas habilitadas.

4. Aceptación, capacidad y vigencia

El usuario deberá ser mayor de dieciocho años y contar con capacidad legal suficiente. La aceptación se realizará mediante una acción afirmativa y quedará registrada con usuario, documento, versión, fecha y hora.

Las casillas obligatorias no estarán preseleccionadas. Los consentimientos opcionales se solicitarán separadamente. Las modificaciones materiales requerirán nueva aceptación antes de continuar utilizando funciones reguladas.

5. Registro, autenticación y seguridad de la cuenta

El registro es obligatorio. El usuario deberá proporcionar los datos necesarios para identidad, contacto, categoría, seguridad, pagos y cumplimiento, incluyendo nombre, RUT o pasaporte, correo electrónico, teléfono y los demás antecedentes que la App identifique como obligatorios. La fotografía del pasajero será opcional.

La cuenta podrá crearse o autenticarse mediante correo electrónico y contraseña, Google y, en iOS, Sign in with Apple. Facebook no forma parte de la versión de lanzamiento. Las identidades se vincularán a una única cuenta y no se fusionarán automáticamente por la sola coincidencia de correo.

Quien ingrese mediante Google o Apple podrá configurar una contraseña Rapa Go de respaldo mediante verificación de correo. El usuario deberá proteger sus credenciales y reportar accesos no autorizados.

6. Categorías de usuario, residencia y visitantes

La App podrá distinguir entre ‘RAPA NUI / RESIDENTE RAPA NUI’, visitante chileno y visitante extranjero. Para efectos de la categoría de residente, la expresión se refiere exclusivamente a residencia territorial habilitada y acreditada y no constituye declaración ni certificación de pertenencia étnica.

Rapa Go podrá aplicar tarifas distintas entre las categorías de visitante chileno y visitante extranjero. En todos los casos, el precio total aplicable a la categoría declarada y/o verificada será informado antes de confirmar el servicio.

El usuario deberá proporcionar antecedentes veraces y, cuando corresponda, acreditar residencia. La información falsa o inconsistente podrá dar lugar a recategorización, cobro de diferencias, advertencia, suspensión o bloqueo en casos graves o reiterados.

7. Naturaleza y objeto de Rapa Go

Rapa Go proporciona infraestructura tecnológica para coordinar el contacto entre usuarios y conductores independientes; informa tarifas, administra reglas operativas, registra viajes, procesa o coordina pagos y brinda soporte.

El conductor decide libremente si acepta una oferta. La publicación de una solicitud no garantiza aceptación ni tiempo exacto de llegada. Lo anterior no limita las responsabilidades legales propias del Operador por sus actos, sistemas, información, cobros u obligaciones frente a consumidores.

8. Solicitud, autorización de pago y asignación

Antes de confirmar, el usuario indicará origen, destino, categoría y medio de pago. Cuando se utilice pago electrónico, al enviar la solicitud o reserva Itaú Klap podrá efectuar una autorización o retención por hasta el monto total informado, sin que ello implique por sí solo un cobro definitivo.

La App buscará y asignará la solicitud a un conductor por vez mediante criterios objetivos como proximidad, disponibilidad, categoría y capacidad. Se considerará efectivamente asignado un conductor cuando la aceptación sea registrada por el sistema y dicha asignación sea confirmada al usuario.

Si no se logra designar conductor, la autorización o retención deberá liberarse íntegramente y no procederá captura por el viaje no ejecutado.

9. Información del conductor y vehículo

Antes del inicio, la App mostrará, según disponibilidad técnica, nombre y fotografía del conductor, calificación, marca, modelo, color, patente y ubicación aproximada. El usuario deberá verificar coincidencia y abstenerse de abordar ante una discrepancia relevante, reportándola a Rapa Go.

10. Categorías, equipaje y servicios no disponibles

Las categorías iniciales podrán incluir Estándar, XL, Maletas y Express o Prioritario. Express podrá mostrarse cuando la asignación ordinaria tarde más de lo esperado. Confort, Encomiendas, Tours, Rent a Car, Eventos y otras funciones futuras no se entenderán ofrecidas mientras no estén habilitadas y sujetas a condiciones específicas.

Los objetos voluminosos deberán solicitarse en categoría compatible. No se permite transportar pasajeros en pick-up o espacios no habilitados. En el lanzamiento no se aceptan mascotas ni viajes multidestino o paradas adicionales.

11. Tarifas dinámicas, precio y redondeo

Las tarifas pueden considerar distancia, categoría, demanda, disponibilidad, residencia o categoría de visitante, reserva, modalidad Express, promociones y condiciones operativas. El precio total mostrado antes de confirmar incorporará el redondeo que corresponda, incluido el redondeo a múltiplos de $500 cuando esté configurado.

El precio será cerrado, salvo error manifiesto, modificación autorizada por el usuario, contingencia de seguridad, corte de camino, instrucción de autoridad, fuerza mayor u otra circunstancia objetivamente verificable. La App no permite agregar paradas o destinos después de confirmar.

12. Pagos electrónicos, captura y documentación tributaria

Los servicios podrán pagarse mediante Itaú Klap y, cuando se ofrezca expresamente, en efectivo. Rapa Go no conserva números completos de tarjetas ni códigos de seguridad.

Si el servicio se ejecuta íntegramente, se capturará el monto total autorizado conforme al precio contratado. Si corresponde un cargo de cancelación o no show, se capturará únicamente el monto aplicable y se liberará el saldo restante de la autorización. Si no corresponde cobro, la autorización será liberada íntegramente.

El comprobante de Itaú Klap acredita el procesamiento de la operación y no reemplaza el documento tributario que corresponda. Haka Taiko SpA emitirá la boleta o factura aplicable y la enviará al correo registrado conforme al flujo tributario vigente. Para solicitar factura deberán proporcionarse los datos tributarios necesarios.

13. Beneficios, saldos y reembolsos

Los beneficios o saldos podrán originarse por pagos en exceso, ajustes, devoluciones o promociones. No pueden cargarse voluntariamente, transferirse entre usuarios ni retirarse directamente desde la App.

Un saldo reembolsable podrá utilizarse en servicios posteriores o solicitarse en devolución mediante Centro de Ayuda o pagos@rapago.cl. Rapa Go verificará la titularidad bancaria y tramitará la devolución en plazos razonables conforme a su procedimiento operativo.

Los créditos promocionales podrán sujetarse a condiciones propias y no necesariamente serán canjeables por dinero.

14. Cancelación del pasajero después de la asignación del conductor

Desde el momento en que un conductor queda efectivamente designado/asignado al viaje comienza a correr un plazo de un minuto, registrado por el sistema.

Si el pasajero cancela antes de cumplirse íntegramente un minuto desde la asignación confirmada, no existirá cobro y se liberará completamente la autorización o retención asociada al servicio.

Si el pasajero cancela una vez transcurrido un minuto desde la asignación confirmada, se aplicará un cargo equivalente al treinta por ciento de la tarifa total del servicio, con un tope máximo de $3.000. El cargo será, por tanto, el menor valor entre el 30% de la tarifa y $3.000.

No procederá el cargo cuando exista discrepancia relevante del conductor o vehículo, riesgo de seguridad, error de la Plataforma, duplicidad, cancelación imputable al conductor u otra causa objetiva aceptada por Rapa Go.

15. Ausencia de conductor y cancelación atribuible al conductor

Si no se designa conductor, no se realizará cobro y se liberará íntegramente la autorización. Si un conductor ya asignado cancela, no se cargará al pasajero por dicha cancelación y la Plataforma podrá iniciar un proceso de reasignación, sujeto a disponibilidad.

16. Reservas programadas

En las reservas programadas, la cancelación será gratuita hasta treinta minutos antes del horario reservado. Dentro de los treinta minutos previos podrá aplicarse un cargo equivalente al 30% de la tarifa total, con tope de $3.000, salvo causa justificada o incumplimiento imputable a Rapa Go o al conductor.

17. No presentación del pasajero (No Show)

Si el conductor registra su llegada al punto de retiro y el pasajero no se presenta dentro de cinco minutos, podrá aplicarse un cargo equivalente al cincuenta por ciento del valor total del viaje, con tope de $5.000.

El cargo requiere llegada verificable y tiempo de espera registrado. No procederá cuando exista error relevante de ubicación, imposibilidad de contacto imputable a la Plataforma, discrepancia del vehículo o conductor, riesgo de seguridad u otra causa objetiva aceptada por Rapa Go.

La distribución interna del cargo entre Rapa Go y el conductor no modifica el monto informado al usuario.

18. Obligaciones del usuario

• Proporcionar información verdadera y mantener datos y medios de contacto actualizados.

• Estar disponible en el punto de retiro y verificar conductor y vehículo.

• Usar cinturón de seguridad y cumplir instrucciones razonables de seguridad.

• No exceder capacidad; solicitar categoría compatible con equipaje; y proveer sistema de retención infantil cuando legalmente corresponda.

• Pagar tarifa y cargos válidamente informados.

• Tratar respetuosamente a conductores, personal y comunidad.

• No solicitar detenciones, rutas o conductas contrarias a la ley o seguridad.

19. Conductas prohibidas

• Fraude, suplantación, cuentas múltiples abusivas, contracargos infundados o manipulación de promociones.

• Agresión, amenaza, acoso, discriminación, daños o lenguaje ofensivo.

• Portar objetos ilícitos, peligrosos o incompatibles con transporte seguro.

• Solicitar servicios fuera de la App para eludir tarifas, trazabilidad o seguridad.

• Interferir con la App, geolocalización, pagos o sistemas de seguridad.

• Usar datos personales del conductor para fines distintos del viaje.

20. Seguridad, rechazo o término anticipado

El conductor podrá rechazar o terminar un servicio si existe riesgo, agresión, exceso de pasajeros, conducta ilícita, equipaje peligroso, condiciones inseguras, camino bloqueado o fuerza mayor. Cuando sea posible deberá detenerse en un lugar seguro. Rapa Go podrá investigar y adoptar medidas proporcionales.

21. Accidentes, incidentes y emergencias

Ante riesgo inmediato, el usuario deberá contactar directamente a los servicios públicos de emergencia. Los canales de Rapa Go permiten reportar y preservar antecedentes, pero no reemplazan a Carabineros, servicios de salud, Bomberos ni autoridades competentes.

Rapa Go podrá solicitar ubicación, fotografías, relato, identificación del viaje y documentos; podrá suspender preventivamente cuentas o vehículos mientras verifica un incidente grave y colaborará con requerimientos formales de autoridad.

22. Responsabilidad y derechos del consumidor

El conductor responde por la conducción y ejecución material del servicio. Rapa Go responde por sus propios actos u omisiones, administración de la Plataforma, información, sistemas y obligaciones legales.

Rapa Go no garantiza disponibilidad permanente, tiempo exacto de llegada ni funcionamiento ininterrumpido en condiciones de baja conectividad, GPS deficiente, clima, caminos, fallas de terceros o fuerza mayor.

Ninguna cláusula excluye derechos irrenunciables del consumidor, responsabilidad por dolo o culpa grave ni responsabilidades que la ley no permita limitar.

23. Objetos olvidados

El usuario deberá reportar el objeto mediante Centro de Ayuda, WhatsApp o reclamos@rapago.cl, indicando viaje, descripción y contacto. Rapa Go realizará gestiones razonables sin garantizar recuperación. Si el conductor debe efectuar un desplazamiento adicional, podrá aplicarse un cargo de gestión previamente informado.

24. Calificaciones y comentarios

El usuario podrá calificar al conductor. Los comentarios escritos serán privados y accesibles únicamente al personal autorizado de Administración, Soporte y Jurídica cuando exista necesidad funcional. El conductor verá su puntuación y métricas, no el texto privado, salvo que sea necesario comunicar antecedentes esenciales de una investigación resguardando datos de terceros.

25. Soporte y reclamos

Los canales oficiales para pasajeros son el Centro de Ayuda dentro de la App, soporte@rapago.cl, reclamos@rapago.cl, privacidad@rapago.cl y WhatsApp institucional +56 9 4796 4171.

La atención a pasajeros se prestará principalmente por medios digitales y remotos. La recepción de solicitudes puede ser automática. Rapa Go no garantiza atención humana inmediata, permanente ni presencial para pasajeros, y procurará responder de acuerdo con la naturaleza y complejidad del caso.

Los asuntos simples serán gestionados preferentemente dentro de tres días hábiles y los complejos dentro de cinco; las investigaciones podrán extenderse hasta diez días hábiles, prorrogables fundadamente.

26. Respeto al Pueblo Rapa Nui, cultura y patrimonio

La operación se desarrolla en un territorio de alto valor cultural, espiritual, histórico, arqueológico, comunitario y ambiental. Todos los usuarios deberán respetar al Pueblo Rapa Nui, su idioma, tradiciones, comunidades, sitios sagrados, patrimonio, propietarios y reglas de convivencia.

• Está prohibido ingresar o promover el ingreso a zonas arqueológicas, sagradas, privadas o restringidas sin autorización.

• Está prohibido tocar, remover, dañar, intervenir, profanar o alterar patrimonio cultural o natural.

• No se permiten burlas, discriminación ni conductas ofensivas.

• El servicio de movilidad no incluye entradas, permisos, accesos ni guiado turístico profesional.

• Un incumplimiento grave podrá originar bloqueo y, cuando corresponda, comunicación a la autoridad.

27. Privacidad y tratamiento de datos

El tratamiento se rige por la Política de Privacidad publicada en api.rapago.cl/privacidad. Haka Taiko SpA es responsable del tratamiento bajo la marca Rapa Go.

La infraestructura de producción incluye páginas y frontend en api.rapago.cl, API en backend.rapago.cl alojada en Hostinger, y PostgreSQL/Supabase en São Paulo, Brasil, además de los proveedores de autenticación, mapas, ubicación, pagos, correo y soporte descritos en la Política.

Rapa Go aplicará medidas de seguridad, accesos por roles, cifrado, auditoría, respaldos y conservación proporcional. La Política se adecuará a la legislación vigente y a la entrada en vigor de la Ley N.º 21.719 el 1 de diciembre de 2026.

28. Geolocalización

El pasajero compartirá ubicación cuando confirme el origen o envíe la solicitud. Puede ingresar manualmente origen y destino si rechaza el permiso de ubicación.

La ubicación del conductor antes del viaje se utilizará transitoriamente para disponibilidad y asignación; se conservará solo la última coordenada operativa por hasta quince minutos y no se generará una ruta previa. Durante un servicio activo, el conductor podrá transmitir ubicación en segundo plano cuando sea indispensable. El seguimiento finalizará al completar, cancelar, cerrar sesión o perder autorización, sin perjuicio de registros ya generados.

29. Eliminación de cuenta

El usuario podrá iniciar la eliminación desde la App y desde api.rapago.cl/eliminar-cuenta. El proceso exige verificación razonable de identidad y se completará dentro de treinta días desde la verificación, salvo aplazamiento objetivo.

La eliminación podrá aplazarse por viaje o reserva activa, saldo o devolución pendiente, reclamo, contracargo, investigación de fraude u obligación legal. La cuenta no se mantendrá activa por el solo hecho de conservar registros mínimos.

El motivo de eliminación será opcional y podrá seleccionarse ‘Prefiero no indicar’. La falta de motivo no impedirá el ejercicio. Solo podrá no procesarse una solicitud cuando no sea posible verificar identidad, corresponda a una cuenta inexistente o duplicada, o la solicitud ya haya sido ejecutada.

Cuando la cuenta use Sign in with Apple, Rapa Go revocará los tokens asociados mediante el procedimiento oficial de Apple al ejecutar la eliminación.

30. Propiedad intelectual, licencia y tiendas

Rapa Go, la App, interfaces, software, bases de datos, diseños, textos, gráficos y signos pertenecen al Operador o sus licenciantes. El usuario recibe una licencia personal, limitada, revocable, no exclusiva e intransferible para uso legítimo.

En dispositivos Apple, la licencia de la aplicación se complementa con la EULA estándar de Apple. Apple y Google no prestan el servicio de movilidad ni son parte del contrato entre el usuario y Rapa Go.

31. Proveedores y servicios de terceros

La App integra, según sistema operativo y versión, Google Sign-In, Sign in with Apple en iOS, Google Maps y servicios nativos de ubicación, Itaú Klap, Hostinger, Supabase, Gmail/SMTP y WhatsApp. Facebook Login, Firebase, Sentry, Google Analytics y Crashlytics no se encuentran activos en la versión de lanzamiento.

Cada proveedor puede estar sujeto a sus propios términos y políticas. Rapa Go procurará limitar los datos al mínimo necesario y reflejar el tratamiento en su Política de Privacidad y en las declaraciones de las tiendas.

32. Disponibilidad, actualizaciones y continuidad

Rapa Go podrá corregir, mejorar, suspender temporalmente o retirar funciones por mantenimiento, seguridad, cumplimiento o necesidades operativas. Los servicios coordinados completamente fuera de la App no disponen de su trazabilidad, soporte ni mecanismos de reclamo.

33. Módulos futuros

Rapa Go podrá incorporar Tours, Rent a Car, Eventos, Encomiendas, Publicidad u otros módulos. Cada uno tendrá condiciones específicas. Mientras no aparezca habilitado no se entenderá ofrecido ni contratado.

34. Modificaciones

Rapa Go podrá modificar estos Términos por cambios legales, regulatorios, tecnológicos, operativos o comerciales. Las modificaciones materiales se informarán y requerirán aceptación expresa. Se conservará historial de versiones.

35. Ley aplicable, domicilio y competencia

Estos Términos se rigen por las leyes de Chile. El Operador fija domicilio en Isla de Pascua para comunicaciones, sin perjuicio de los derechos irrenunciables del consumidor y de las reglas legales de competencia. El usuario podrá recurrir a Rapa Go, al Servicio Nacional del Consumidor y a los tribunales o autoridades que determine la ley.

36. Idioma, vigencia y contacto

Los Términos podrán ofrecerse en español e inglés. En caso de discrepancia interpretativa prevalecerá el español, sin afectar derechos legales. La versión 4.0 entra en vigor desde su publicación y aceptación electrónica.

Materia | Canal oficial

Soporte general | Centro de Ayuda · soporte@rapago.cl · WhatsApp +56 9 4796 4171

Reclamos | reclamos@rapago.cl

Privacidad y eliminación | privacidad@rapago.cl · api.rapago.cl/eliminar-cuenta

Pagos y reembolsos | pagos@rapago.cl

Facturación | contabilidad@rapago.cl

Comunicaciones legales | legal@rapago.cl

Domicilio | Miru s/n, Isla de Pascua, Chile

ACEPTACIÓN Al seleccionar “Acepto”, el usuario declara haber leído y comprendido estos Términos y acepta quedar obligado por ellos, por las Condiciones de Usuarios y por las reglas específicas mostradas antes de contratar.
$rapago_terms_v4$,
      '2026-08-13',
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO target_id;
  ELSE
    UPDATE legal_documents
    SET title = 'Términos y Condiciones Generales de Uso',
        effective_date = '2026-08-13',
        is_active = true,
        updated_at = NOW()
    WHERE id = target_id;
  END IF;

  UPDATE legal_documents
  SET is_active = (id = target_id),
      updated_at = CASE
        WHEN id = target_id OR is_active = true THEN NOW()
        ELSE updated_at
      END
  WHERE type = 'terms_and_conditions';
END
$publish_rapago_terms_v4$;

DO $publish_rapago_users_v11$
DECLARE
  target_id uuid;
BEGIN
  SELECT id
  INTO target_id
  FROM legal_documents
  WHERE type = 'user_conditions'
    AND version = '1.1'
    AND content = $rapago_users_v11$RAPA GO

CONDICIONES DE USUARIOS

Anexo operativo subordinado a los Términos y Condiciones Generales

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 1.1

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Anexo aplicable a pasajeros y usuarios. No reemplaza ni modifica los Términos Generales. En caso de contradicción, prevalecen los Términos Generales y la legislación aplicable.

1. Objeto, subordinación y prevalencia

Estas Condiciones establecen reglas operativas de uso, seguridad y convivencia para pasajeros y usuarios. Forman parte del paquete legal de Rapa Go y están subordinadas a los Términos y Condiciones Generales.

En caso de discrepancia, prevalecerán los Términos Generales y la legislación aplicable.

2. Registro y cuenta

• Utilizar una cuenta propia con datos verdaderos y actualizados.

• No compartir credenciales ni permitir su uso por terceros.

• Reportar accesos no autorizados.

• Utilizar la categoría tarifaria que corresponda al pasajero efectivo.

3. Solicitud y punto de retiro

• Ingresar origen y destino correctos antes de confirmar.

• Estar preparado en el punto de retiro.

• Verificar nombre, fotografía, patente, marca y color del vehículo.

• No abordar si existe discrepancia y reportarla inmediatamente.

4. Cancelación después de asignación y No Show

La cancelación es gratuita durante el primer minuto contado desde la asignación confirmada del conductor. Si el pasajero cancela antes de cumplirse íntegramente ese minuto, la autorización se libera y no existe cobro.

Una vez transcurrido un minuto desde la asignación confirmada, se cobra el 30% del valor total del viaje, con tope de $3.000.

El No Show se configura cuando el conductor registra llegada y transcurren cinco minutos sin presentación del pasajero; se cobra 50% del valor del viaje, con tope de $5.000.

Las excepciones por seguridad, error de la Plataforma, discrepancia del vehículo/conductor o causa imputable al conductor serán evaluadas por Soporte.

5. Durante el viaje

• Usar cinturón de seguridad y cumplir normas de tránsito.

• No fumar, consumir sustancias prohibidas, agredir, amenazar ni acosar.

• No exceder capacidad autorizada.

• No solicitar rutas, paradas o conductas inseguras o ilícitas.

• Mantener limpieza y respeto por el vehículo.

6. Equipaje y objetos especiales

El usuario deberá seleccionar una categoría compatible con maletas u objetos voluminosos. El conductor podrá rechazar objetos que comprometan la seguridad o dañen el vehículo. No se admiten pasajeros en zonas de carga. No se ofrecen mascotas, encomiendas ni multidestino en la primera versión.

7. Niños, niñas y adolescentes

La versión inicial no permite que menores viajen sin un adulto acompañante responsable. El adulto deberá proporcionar e instalar el sistema de retención infantil que legalmente corresponda.

8. Pagos, beneficios y devoluciones

El usuario deberá mantener medio de pago y correo vigentes. En pagos electrónicos, Itaú Klap podrá efectuar una autorización previa y Rapa Go capturará únicamente el monto que corresponda conforme al servicio o cargos aplicables.

Los beneficios no son transferibles ni retirables directamente desde la App. Los saldos reembolsables podrán aplicarse a futuros servicios o solicitarse a pagos@rapago.cl o Centro de Ayuda.

9. Seguridad e incidentes

Ante riesgo inmediato, el usuario deberá contactar servicios públicos de emergencia. Posteriormente podrá reportar el caso a Rapa Go con identificación del viaje, relato y evidencia. Rapa Go no sustituye a Carabineros, servicios de salud, Bomberos ni autoridades.

10. Objetos olvidados

El usuario deberá reportar el objeto por Centro de Ayuda, WhatsApp o reclamos@rapago.cl. La recuperación no está garantizada y un desplazamiento adicional del conductor puede generar un cargo previamente informado.

11. Calificaciones y comentarios

Las calificaciones deben basarse en experiencias reales. Los comentarios son privados y no deben contener datos personales innecesarios, amenazas, discriminación, falsedades ni contenido ilícito.

12. Respeto cultural y territorial

• Respetar sitios sagrados, arqueológicos, privados y restringidos.

• No tocar, remover, intervenir ni dañar patrimonio.

• No solicitar a un conductor que infrinja restricciones territoriales o ambientales.

• Comprender que un viaje de movilidad no incluye tour, permiso, entrada ni guía.

13. Soporte y reclamos

Los canales oficiales son Centro de Ayuda, soporte@rapago.cl, reclamos@rapago.cl y WhatsApp +56 9 4796 4171. La atención se presta principalmente por medios digitales y remotos; la recepción puede ser automática y no existe garantía de atención humana inmediata, presencial o permanente.

14. Incumplimiento

El incumplimiento podrá originar advertencia, cargo válido, investigación, suspensión, bloqueo o cierre de cuenta, según gravedad, reiteración y derechos aplicables.

15. Aceptación y versión

Estas Condiciones se aceptan electrónicamente como anexo subordinado. La aceptación registra usuario, versión, fecha y hora. Toda modificación material requerirá nueva aceptación.

CLÁUSULA DE PREVALENCIA En caso de contradicción o diferencia interpretativa, prevalecen los Términos y Condiciones Generales de Rapa Go.
$rapago_users_v11$
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF target_id IS NULL THEN
    INSERT INTO legal_documents (
      type, version, title, content, effective_date, is_active, created_at, updated_at
    )
    VALUES (
      'user_conditions',
      '1.1',
      'Condiciones de Usuarios',
      $rapago_users_v11$RAPA GO

CONDICIONES DE USUARIOS

Anexo operativo subordinado a los Términos y Condiciones Generales

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 1.1

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Anexo aplicable a pasajeros y usuarios. No reemplaza ni modifica los Términos Generales. En caso de contradicción, prevalecen los Términos Generales y la legislación aplicable.

1. Objeto, subordinación y prevalencia

Estas Condiciones establecen reglas operativas de uso, seguridad y convivencia para pasajeros y usuarios. Forman parte del paquete legal de Rapa Go y están subordinadas a los Términos y Condiciones Generales.

En caso de discrepancia, prevalecerán los Términos Generales y la legislación aplicable.

2. Registro y cuenta

• Utilizar una cuenta propia con datos verdaderos y actualizados.

• No compartir credenciales ni permitir su uso por terceros.

• Reportar accesos no autorizados.

• Utilizar la categoría tarifaria que corresponda al pasajero efectivo.

3. Solicitud y punto de retiro

• Ingresar origen y destino correctos antes de confirmar.

• Estar preparado en el punto de retiro.

• Verificar nombre, fotografía, patente, marca y color del vehículo.

• No abordar si existe discrepancia y reportarla inmediatamente.

4. Cancelación después de asignación y No Show

La cancelación es gratuita durante el primer minuto contado desde la asignación confirmada del conductor. Si el pasajero cancela antes de cumplirse íntegramente ese minuto, la autorización se libera y no existe cobro.

Una vez transcurrido un minuto desde la asignación confirmada, se cobra el 30% del valor total del viaje, con tope de $3.000.

El No Show se configura cuando el conductor registra llegada y transcurren cinco minutos sin presentación del pasajero; se cobra 50% del valor del viaje, con tope de $5.000.

Las excepciones por seguridad, error de la Plataforma, discrepancia del vehículo/conductor o causa imputable al conductor serán evaluadas por Soporte.

5. Durante el viaje

• Usar cinturón de seguridad y cumplir normas de tránsito.

• No fumar, consumir sustancias prohibidas, agredir, amenazar ni acosar.

• No exceder capacidad autorizada.

• No solicitar rutas, paradas o conductas inseguras o ilícitas.

• Mantener limpieza y respeto por el vehículo.

6. Equipaje y objetos especiales

El usuario deberá seleccionar una categoría compatible con maletas u objetos voluminosos. El conductor podrá rechazar objetos que comprometan la seguridad o dañen el vehículo. No se admiten pasajeros en zonas de carga. No se ofrecen mascotas, encomiendas ni multidestino en la primera versión.

7. Niños, niñas y adolescentes

La versión inicial no permite que menores viajen sin un adulto acompañante responsable. El adulto deberá proporcionar e instalar el sistema de retención infantil que legalmente corresponda.

8. Pagos, beneficios y devoluciones

El usuario deberá mantener medio de pago y correo vigentes. En pagos electrónicos, Itaú Klap podrá efectuar una autorización previa y Rapa Go capturará únicamente el monto que corresponda conforme al servicio o cargos aplicables.

Los beneficios no son transferibles ni retirables directamente desde la App. Los saldos reembolsables podrán aplicarse a futuros servicios o solicitarse a pagos@rapago.cl o Centro de Ayuda.

9. Seguridad e incidentes

Ante riesgo inmediato, el usuario deberá contactar servicios públicos de emergencia. Posteriormente podrá reportar el caso a Rapa Go con identificación del viaje, relato y evidencia. Rapa Go no sustituye a Carabineros, servicios de salud, Bomberos ni autoridades.

10. Objetos olvidados

El usuario deberá reportar el objeto por Centro de Ayuda, WhatsApp o reclamos@rapago.cl. La recuperación no está garantizada y un desplazamiento adicional del conductor puede generar un cargo previamente informado.

11. Calificaciones y comentarios

Las calificaciones deben basarse en experiencias reales. Los comentarios son privados y no deben contener datos personales innecesarios, amenazas, discriminación, falsedades ni contenido ilícito.

12. Respeto cultural y territorial

• Respetar sitios sagrados, arqueológicos, privados y restringidos.

• No tocar, remover, intervenir ni dañar patrimonio.

• No solicitar a un conductor que infrinja restricciones territoriales o ambientales.

• Comprender que un viaje de movilidad no incluye tour, permiso, entrada ni guía.

13. Soporte y reclamos

Los canales oficiales son Centro de Ayuda, soporte@rapago.cl, reclamos@rapago.cl y WhatsApp +56 9 4796 4171. La atención se presta principalmente por medios digitales y remotos; la recepción puede ser automática y no existe garantía de atención humana inmediata, presencial o permanente.

14. Incumplimiento

El incumplimiento podrá originar advertencia, cargo válido, investigación, suspensión, bloqueo o cierre de cuenta, según gravedad, reiteración y derechos aplicables.

15. Aceptación y versión

Estas Condiciones se aceptan electrónicamente como anexo subordinado. La aceptación registra usuario, versión, fecha y hora. Toda modificación material requerirá nueva aceptación.

CLÁUSULA DE PREVALENCIA En caso de contradicción o diferencia interpretativa, prevalecen los Términos y Condiciones Generales de Rapa Go.
$rapago_users_v11$,
      '2026-08-13',
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO target_id;
  ELSE
    UPDATE legal_documents
    SET title = 'Condiciones de Usuarios',
        effective_date = '2026-08-13',
        is_active = true,
        updated_at = NOW()
    WHERE id = target_id;
  END IF;

  UPDATE legal_documents
  SET is_active = (id = target_id),
      updated_at = CASE
        WHEN id = target_id OR is_active = true THEN NOW()
        ELSE updated_at
      END
  WHERE type = 'user_conditions';
END
$publish_rapago_users_v11$;

DO $publish_rapago_privacy_v10$
DECLARE
  target_id uuid;
BEGIN
  SELECT id
  INTO target_id
  FROM legal_documents
  WHERE type = 'privacy_policy'
    AND version = '1.0'
    AND content = $rapago_privacy_v10$RAPA GO

POLÍTICA DE PRIVACIDAD Y TRATAMIENTO DE DATOS PERSONALES

Usuarios, pasajeros, postulantes y conductores

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 1.0

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Política pública aplicable al tratamiento de datos realizado por Haka Taiko SpA bajo la marca Rapa Go. Debe publicarse en api.rapago.cl/privacidad y estar accesible dentro de la App y en las fichas de las tiendas.

RESPONSABLE DEL TRATAMIENTO Haka Taiko SpA, RUT 77.930.635-6, domicilio Miru s/n, Isla de Pascua, Chile. Contacto de privacidad: privacidad@rapago.cl.

1. Objeto y alcance

Esta Política explica qué datos personales trata Rapa Go, de dónde provienen, con qué finalidades se utilizan, con quién pueden compartirse, dónde se alojan, cuánto tiempo se conservan, qué medidas de seguridad se aplican y cómo pueden ejercerse los derechos de los titulares.

Se aplica a pasajeros, usuarios, postulantes a conductor, conductores habilitados y personas que contacten soporte o utilicen páginas públicas de Rapa Go.

2. Marco normativo y principios

El tratamiento se realizará conforme a la Ley N.º 19.628 sobre protección de la vida privada y demás normativa vigente. La Ley N.º 21.719 entra en vigor el 1 de diciembre de 2026; Rapa Go adecuará sus procedimientos, bases de legitimación, registros, contratos con encargados, derechos de titulares y medidas de cumplimiento al régimen que resulte exigible desde esa fecha.

Rapa Go procurará tratar datos de manera lícita, proporcional, transparente, segura y limitada a finalidades determinadas. Los datos no se utilizarán para finalidades incompatibles con aquellas informadas, salvo habilitación legal o nuevo consentimiento cuando corresponda.

3. Datos tratados de pasajeros y usuarios

• Identificación y contacto: nombre, apellidos, RUT o pasaporte, correo electrónico, teléfono y nacionalidad/categoría de visitante.

• Residencia: categoría de residente y antecedentes de acreditación cuando se soliciten.

• Perfil: fotografía opcional y preferencias operativas disponibles en la App.

• Autenticación: identificadores de Google y, en iOS, Apple; correo asociado, estado de verificación, tokens o referencias técnicas necesarias para sesión y seguridad. Facebook no se utiliza en la versión de lanzamiento.

• Ubicación y viajes: coordenadas necesarias para origen, destino, asignación, ruta, seguimiento, tiempos, cancelaciones y seguridad; historial de viajes y reservas.

• Pagos: monto, estado, identificadores de orden/transacción, medio general de pago y datos operativos recibidos de Itaú Klap. Rapa Go no almacena números completos de tarjeta ni CVV.

• Beneficios y reembolsos: saldos, ajustes y, cuando se solicita devolución, datos bancarios necesarios para transferir el monto.

• Calificaciones, comentarios, reclamos, comunicaciones y evidencia aportada al Centro de Ayuda, correo o WhatsApp.

• Datos técnicos y de seguridad: IP, sesión, identificadores técnicos razonablemente necesarios, timestamps, eventos de autenticación, auditoría y prevención de fraude.

4. Datos tratados de postulantes y conductores

• Identificación, contacto, fecha de nacimiento, domicilio y residencia tributaria en Rapa Nui.

• Licencia de conducir, permiso de circulación, fotografía, antecedentes e inhabilidades requeridos por la Plataforma.

• Datos del vehículo: patente, marca, modelo, año, color, titularidad/autorización y categorías habilitadas.

• Datos bancarios y tributarios necesarios para pagos y liquidaciones.

• Historial de viajes, tiempos efectivos, disponibilidad, franja de desconexión, liquidaciones, calificaciones, reclamos e investigaciones.

• Geolocalización durante disponibilidad, asignación y servicio activo, incluida ubicación en segundo plano cuando sea indispensable.

• Datos sensibles relativos a pertenencia al Pueblo Rapa Nui y antecedentes familiares, como certificados de nacimiento, únicamente cuando el postulante voluntariamente los aporte para acreditar la calidad o habilitación invocada y preste consentimiento expreso.

5. Fuentes de los datos

Los datos provienen directamente del titular; del dispositivo y la App durante el uso; de proveedores de autenticación y pagos; de pasajeros o conductores respecto de calificaciones/reclamos; y, cuando sea legítimo, de fuentes públicas o autoridades competentes para validar antecedentes.

6. Finalidades del tratamiento

• Crear, autenticar, proteger y administrar cuentas.

• Verificar identidad, residencia, categoría tarifaria, habilitación territorial y requisitos del conductor.

• Solicitar, asignar, ejecutar, registrar y dar soporte a viajes y reservas.

• Calcular y mostrar tarifas, aplicar autorizaciones, cobros, liberaciones, cancelaciones, No Show, reembolsos y liquidaciones.

• Emitir y remitir documentación tributaria y mantener registros contables.

• Mantener seguridad, prevenir fraude, investigar incidentes y ejercer o defender derechos.

• Gestionar soporte, reclamos, objetos olvidados, accidentes y solicitudes de privacidad.

• Evaluar calidad mediante calificaciones, sin publicar automáticamente comentarios privados.

• Cumplir obligaciones legales, laborales, tributarias, de consumo, protección de datos y requerimientos de autoridad.

• Enviar comunicaciones operativas. Las promociones se enviarán solo cuando exista la autorización o base aplicable y siempre con mecanismo de oposición o retiro.

7. Consentimiento y datos sensibles

Cuando la legislación exija consentimiento, este se solicitará de forma expresa, informada y separada de finalidades opcionales. La aceptación de la Política no sustituye los permisos contextuales del sistema operativo para ubicación.

Los datos sensibles del conductor relativos a origen étnico o antecedentes familiares solo serán tratados con consentimiento expreso o cuando exista otra habilitación legal aplicable. Negarse a proporcionar un dato sensible solo afectará la posibilidad de acreditar una condición que dependa específicamente de dicho antecedente, cuando no exista un medio alternativo suficiente.

8. Geolocalización

Pasajeros: la ubicación se utiliza al confirmar el origen o solicitar un viaje. Si el usuario no autoriza el permiso, podrá ingresar origen y destino manualmente.

Conductores: la ubicación se utiliza para disponibilidad y asignación. Antes del viaje se conserva únicamente la última coordenada operativa por hasta quince minutos, sin generar una ruta previa. Durante un servicio activo podrá transmitirse ubicación en segundo plano cuando sea indispensable para navegación, seguimiento, seguridad y evidencia.

El seguimiento finaliza al completar o cancelar el viaje, cerrar sesión o revocar el permiso, sin perjuicio de los registros ya generados conforme a esta Política.

9. Autenticación mediante Google y Apple

Rapa Go utiliza Google Sign-In y, en iOS, Sign in with Apple. Estos proveedores pueden comunicar identificadores, nombre, correo y estado de autenticación conforme a las autorizaciones del usuario y sus propias políticas.

Rapa Go vincula las identidades a un único userId y no fusiona cuentas automáticamente por la sola coincidencia de correo. Cuando se elimina una cuenta que utiliza Sign in with Apple, Rapa Go revoca los tokens asociados mediante la API oficial de Apple.

10. Pagos mediante Itaú Klap

Itaú Klap procesa las autorizaciones, capturas, liberaciones y operaciones electrónicas habilitadas. Rapa Go recibe los datos operativos necesarios para asociar la transacción con el viaje, como identificadores de orden, montos, estados y referencias técnicas.

Rapa Go no almacena datos completos de tarjetas ni códigos CVV. El tratamiento realizado directamente por Itaú Klap también se rige por sus propios términos y políticas.

11. Proveedores, encargados y transferencias internacionales

La infraestructura de producción incluye frontend/páginas públicas en api.rapago.cl; API en backend.rapago.cl alojada en Hostinger; y PostgreSQL/Supabase en São Paulo, Brasil.

Rapa Go utiliza o puede utilizar, según la función: Google (autenticación y Google Maps), Apple (Sign in with Apple y servicios nativos iOS), Itaú Klap (pagos), Gmail/SMTP (correo) y WhatsApp/Meta cuando la persona decide comunicarse por ese canal. Facebook Login, Firebase, Sentry, Google Analytics y Crashlytics no están activos en la versión de lanzamiento.

Algunos proveedores pueden tratar datos fuera de Chile. Rapa Go limitará la información compartida a la necesaria para la finalidad correspondiente y adoptará las medidas contractuales y organizativas que exija la legislación vigente.

12. Conservación de datos

Categoría | Plazo o criterio

Cuenta y perfil | Mientras la cuenta esté activa. Tras eliminación, se suprimen o anonimizan dentro del proceso informado, salvo datos sujetos a obligación legal o defensa de derechos.

Última coordenada previa al viaje | Hasta 15 minutos.

Rutas de viajes ordinarios | Hasta 12 meses.

Comentarios y soporte ordinario | Hasta 12 meses desde el cierre del caso o registro, salvo necesidad acreditada.

Accidentes, fraude, contracargos, investigaciones o reclamos relevantes | Hasta 5 años o mientras exista un procedimiento o plazo legal aplicable.

Aceptaciones contractuales, contratos y registros del conductor | Hasta 5 años después del término, o plazo legal superior si corresponde.

Documentos de postulantes no habilitados | Hasta 6 meses, salvo reclamo, deber legal o consentimiento distinto.

Documentación tributaria y respaldos contables | 6 años, sin perjuicio de plazos superiores legalmente aplicables.

Logs generales de auditoría y seguridad | Hasta 12 meses, salvo incidente de seguridad o investigación.

Respaldos cifrados | Ciclo rotativo de hasta 90 días, salvo copias retenidas por contingencia documentada.

Datos bancarios/certificados para reembolso | Solo durante el tiempo necesario para verificar y ejecutar la devolución y controles asociados; luego se eliminarán los documentos no necesarios, conservándose la trazabilidad mínima de la operación.

13. Seguridad

Rapa Go aplica HTTPS/TLS, autenticación y sesiones controladas, tokens, acceso por roles, cifrado de respaldos, controles administrativos, registros de auditoría y restricciones de acceso a documentación sensible. Ningún sistema es absolutamente invulnerable; ante incidentes relevantes se adoptarán medidas de contención, investigación y notificación conforme a la legislación aplicable.

14. Derechos de los titulares

Los titulares pueden solicitar información sobre sus datos, procedencia, destinatarios y finalidades; rectificación de datos erróneos o incompletos; eliminación, cancelación o bloqueo cuando corresponda; y oposición a comunicaciones comerciales, conforme a la legislación vigente.

Las solicitudes se reciben en privacidad@rapago.cl. Rapa Go podrá verificar razonablemente la identidad antes de entregar, modificar o eliminar información y responderá dentro de los plazos legalmente aplicables.

Los conductores conservan, además, los derechos específicos de acceso y portabilidad reconocidos por la normativa de plataformas digitales, incluyendo el acceso a datos relacionados con calificaciones que impacten su desempeño.

15. Eliminación de cuenta

La eliminación puede iniciarse dentro de la App y en api.rapago.cl/eliminar-cuenta. El motivo es opcional. El proceso se completará dentro de treinta días desde la verificación, salvo aplazamiento objetivo por viaje/reserva activa, saldo o devolución pendiente, reclamo, contracargo, fraude o deber legal.

La conservación de registros mínimos no mantendrá activa la cuenta. Si la cuenta utiliza Sign in with Apple, se revocarán los tokens al ejecutar la eliminación.

16. Comunicaciones por WhatsApp y correo

Si la persona contacta a Rapa Go mediante WhatsApp, Meta/WhatsApp tratará el número, nombre de perfil, contenido y metadatos conforme a sus propias políticas. Rapa Go utilizará la conversación para soporte, seguridad, reclamos y evidencia cuando sea necesario.

Los correos transaccionales se utilizan para registro, recuperación, pagos, documentación, soporte y avisos legales. Las comunicaciones comerciales se gestionan separadamente y pueden cancelarse en cualquier momento.

17. Menores de edad

La versión inicial no permite que menores creen cuentas ni soliciten viajes por sí solos. Rapa Go no dirige intencionalmente sus servicios a menores ni pretende recopilar directamente sus datos fuera de los antecedentes estrictamente necesarios cuando viajen acompañados por un adulto responsable.

18. Cambios a la Política

Rapa Go podrá actualizar esta Política por cambios legales, tecnológicos, de proveedores o de operación. Las modificaciones materiales se informarán por la App, correo u otro canal adecuado y se solicitará nueva aceptación o consentimiento cuando sea legalmente necesario.

19. Contacto

Responsable: Haka Taiko SpA, RUT 77.930.635-6. Domicilio: Miru s/n, Isla de Pascua, Chile. Privacidad: privacidad@rapago.cl. Eliminación: api.rapago.cl/eliminar-cuenta. Soporte: soporte@rapago.cl y Centro de Ayuda. Comunicaciones legales: legal@rapago.cl.
$rapago_privacy_v10$
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF target_id IS NULL THEN
    INSERT INTO legal_documents (
      type, version, title, content, effective_date, is_active, created_at, updated_at
    )
    VALUES (
      'privacy_policy',
      '1.0',
      'Política de Privacidad y Tratamiento de Datos Personales',
      $rapago_privacy_v10$RAPA GO

POLÍTICA DE PRIVACIDAD Y TRATAMIENTO DE DATOS PERSONALES

Usuarios, pasajeros, postulantes y conductores

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 1.0

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Política pública aplicable al tratamiento de datos realizado por Haka Taiko SpA bajo la marca Rapa Go. Debe publicarse en api.rapago.cl/privacidad y estar accesible dentro de la App y en las fichas de las tiendas.

RESPONSABLE DEL TRATAMIENTO Haka Taiko SpA, RUT 77.930.635-6, domicilio Miru s/n, Isla de Pascua, Chile. Contacto de privacidad: privacidad@rapago.cl.

1. Objeto y alcance

Esta Política explica qué datos personales trata Rapa Go, de dónde provienen, con qué finalidades se utilizan, con quién pueden compartirse, dónde se alojan, cuánto tiempo se conservan, qué medidas de seguridad se aplican y cómo pueden ejercerse los derechos de los titulares.

Se aplica a pasajeros, usuarios, postulantes a conductor, conductores habilitados y personas que contacten soporte o utilicen páginas públicas de Rapa Go.

2. Marco normativo y principios

El tratamiento se realizará conforme a la Ley N.º 19.628 sobre protección de la vida privada y demás normativa vigente. La Ley N.º 21.719 entra en vigor el 1 de diciembre de 2026; Rapa Go adecuará sus procedimientos, bases de legitimación, registros, contratos con encargados, derechos de titulares y medidas de cumplimiento al régimen que resulte exigible desde esa fecha.

Rapa Go procurará tratar datos de manera lícita, proporcional, transparente, segura y limitada a finalidades determinadas. Los datos no se utilizarán para finalidades incompatibles con aquellas informadas, salvo habilitación legal o nuevo consentimiento cuando corresponda.

3. Datos tratados de pasajeros y usuarios

• Identificación y contacto: nombre, apellidos, RUT o pasaporte, correo electrónico, teléfono y nacionalidad/categoría de visitante.

• Residencia: categoría de residente y antecedentes de acreditación cuando se soliciten.

• Perfil: fotografía opcional y preferencias operativas disponibles en la App.

• Autenticación: identificadores de Google y, en iOS, Apple; correo asociado, estado de verificación, tokens o referencias técnicas necesarias para sesión y seguridad. Facebook no se utiliza en la versión de lanzamiento.

• Ubicación y viajes: coordenadas necesarias para origen, destino, asignación, ruta, seguimiento, tiempos, cancelaciones y seguridad; historial de viajes y reservas.

• Pagos: monto, estado, identificadores de orden/transacción, medio general de pago y datos operativos recibidos de Itaú Klap. Rapa Go no almacena números completos de tarjeta ni CVV.

• Beneficios y reembolsos: saldos, ajustes y, cuando se solicita devolución, datos bancarios necesarios para transferir el monto.

• Calificaciones, comentarios, reclamos, comunicaciones y evidencia aportada al Centro de Ayuda, correo o WhatsApp.

• Datos técnicos y de seguridad: IP, sesión, identificadores técnicos razonablemente necesarios, timestamps, eventos de autenticación, auditoría y prevención de fraude.

4. Datos tratados de postulantes y conductores

• Identificación, contacto, fecha de nacimiento, domicilio y residencia tributaria en Rapa Nui.

• Licencia de conducir, permiso de circulación, fotografía, antecedentes e inhabilidades requeridos por la Plataforma.

• Datos del vehículo: patente, marca, modelo, año, color, titularidad/autorización y categorías habilitadas.

• Datos bancarios y tributarios necesarios para pagos y liquidaciones.

• Historial de viajes, tiempos efectivos, disponibilidad, franja de desconexión, liquidaciones, calificaciones, reclamos e investigaciones.

• Geolocalización durante disponibilidad, asignación y servicio activo, incluida ubicación en segundo plano cuando sea indispensable.

• Datos sensibles relativos a pertenencia al Pueblo Rapa Nui y antecedentes familiares, como certificados de nacimiento, únicamente cuando el postulante voluntariamente los aporte para acreditar la calidad o habilitación invocada y preste consentimiento expreso.

5. Fuentes de los datos

Los datos provienen directamente del titular; del dispositivo y la App durante el uso; de proveedores de autenticación y pagos; de pasajeros o conductores respecto de calificaciones/reclamos; y, cuando sea legítimo, de fuentes públicas o autoridades competentes para validar antecedentes.

6. Finalidades del tratamiento

• Crear, autenticar, proteger y administrar cuentas.

• Verificar identidad, residencia, categoría tarifaria, habilitación territorial y requisitos del conductor.

• Solicitar, asignar, ejecutar, registrar y dar soporte a viajes y reservas.

• Calcular y mostrar tarifas, aplicar autorizaciones, cobros, liberaciones, cancelaciones, No Show, reembolsos y liquidaciones.

• Emitir y remitir documentación tributaria y mantener registros contables.

• Mantener seguridad, prevenir fraude, investigar incidentes y ejercer o defender derechos.

• Gestionar soporte, reclamos, objetos olvidados, accidentes y solicitudes de privacidad.

• Evaluar calidad mediante calificaciones, sin publicar automáticamente comentarios privados.

• Cumplir obligaciones legales, laborales, tributarias, de consumo, protección de datos y requerimientos de autoridad.

• Enviar comunicaciones operativas. Las promociones se enviarán solo cuando exista la autorización o base aplicable y siempre con mecanismo de oposición o retiro.

7. Consentimiento y datos sensibles

Cuando la legislación exija consentimiento, este se solicitará de forma expresa, informada y separada de finalidades opcionales. La aceptación de la Política no sustituye los permisos contextuales del sistema operativo para ubicación.

Los datos sensibles del conductor relativos a origen étnico o antecedentes familiares solo serán tratados con consentimiento expreso o cuando exista otra habilitación legal aplicable. Negarse a proporcionar un dato sensible solo afectará la posibilidad de acreditar una condición que dependa específicamente de dicho antecedente, cuando no exista un medio alternativo suficiente.

8. Geolocalización

Pasajeros: la ubicación se utiliza al confirmar el origen o solicitar un viaje. Si el usuario no autoriza el permiso, podrá ingresar origen y destino manualmente.

Conductores: la ubicación se utiliza para disponibilidad y asignación. Antes del viaje se conserva únicamente la última coordenada operativa por hasta quince minutos, sin generar una ruta previa. Durante un servicio activo podrá transmitirse ubicación en segundo plano cuando sea indispensable para navegación, seguimiento, seguridad y evidencia.

El seguimiento finaliza al completar o cancelar el viaje, cerrar sesión o revocar el permiso, sin perjuicio de los registros ya generados conforme a esta Política.

9. Autenticación mediante Google y Apple

Rapa Go utiliza Google Sign-In y, en iOS, Sign in with Apple. Estos proveedores pueden comunicar identificadores, nombre, correo y estado de autenticación conforme a las autorizaciones del usuario y sus propias políticas.

Rapa Go vincula las identidades a un único userId y no fusiona cuentas automáticamente por la sola coincidencia de correo. Cuando se elimina una cuenta que utiliza Sign in with Apple, Rapa Go revoca los tokens asociados mediante la API oficial de Apple.

10. Pagos mediante Itaú Klap

Itaú Klap procesa las autorizaciones, capturas, liberaciones y operaciones electrónicas habilitadas. Rapa Go recibe los datos operativos necesarios para asociar la transacción con el viaje, como identificadores de orden, montos, estados y referencias técnicas.

Rapa Go no almacena datos completos de tarjetas ni códigos CVV. El tratamiento realizado directamente por Itaú Klap también se rige por sus propios términos y políticas.

11. Proveedores, encargados y transferencias internacionales

La infraestructura de producción incluye frontend/páginas públicas en api.rapago.cl; API en backend.rapago.cl alojada en Hostinger; y PostgreSQL/Supabase en São Paulo, Brasil.

Rapa Go utiliza o puede utilizar, según la función: Google (autenticación y Google Maps), Apple (Sign in with Apple y servicios nativos iOS), Itaú Klap (pagos), Gmail/SMTP (correo) y WhatsApp/Meta cuando la persona decide comunicarse por ese canal. Facebook Login, Firebase, Sentry, Google Analytics y Crashlytics no están activos en la versión de lanzamiento.

Algunos proveedores pueden tratar datos fuera de Chile. Rapa Go limitará la información compartida a la necesaria para la finalidad correspondiente y adoptará las medidas contractuales y organizativas que exija la legislación vigente.

12. Conservación de datos

Categoría | Plazo o criterio

Cuenta y perfil | Mientras la cuenta esté activa. Tras eliminación, se suprimen o anonimizan dentro del proceso informado, salvo datos sujetos a obligación legal o defensa de derechos.

Última coordenada previa al viaje | Hasta 15 minutos.

Rutas de viajes ordinarios | Hasta 12 meses.

Comentarios y soporte ordinario | Hasta 12 meses desde el cierre del caso o registro, salvo necesidad acreditada.

Accidentes, fraude, contracargos, investigaciones o reclamos relevantes | Hasta 5 años o mientras exista un procedimiento o plazo legal aplicable.

Aceptaciones contractuales, contratos y registros del conductor | Hasta 5 años después del término, o plazo legal superior si corresponde.

Documentos de postulantes no habilitados | Hasta 6 meses, salvo reclamo, deber legal o consentimiento distinto.

Documentación tributaria y respaldos contables | 6 años, sin perjuicio de plazos superiores legalmente aplicables.

Logs generales de auditoría y seguridad | Hasta 12 meses, salvo incidente de seguridad o investigación.

Respaldos cifrados | Ciclo rotativo de hasta 90 días, salvo copias retenidas por contingencia documentada.

Datos bancarios/certificados para reembolso | Solo durante el tiempo necesario para verificar y ejecutar la devolución y controles asociados; luego se eliminarán los documentos no necesarios, conservándose la trazabilidad mínima de la operación.

13. Seguridad

Rapa Go aplica HTTPS/TLS, autenticación y sesiones controladas, tokens, acceso por roles, cifrado de respaldos, controles administrativos, registros de auditoría y restricciones de acceso a documentación sensible. Ningún sistema es absolutamente invulnerable; ante incidentes relevantes se adoptarán medidas de contención, investigación y notificación conforme a la legislación aplicable.

14. Derechos de los titulares

Los titulares pueden solicitar información sobre sus datos, procedencia, destinatarios y finalidades; rectificación de datos erróneos o incompletos; eliminación, cancelación o bloqueo cuando corresponda; y oposición a comunicaciones comerciales, conforme a la legislación vigente.

Las solicitudes se reciben en privacidad@rapago.cl. Rapa Go podrá verificar razonablemente la identidad antes de entregar, modificar o eliminar información y responderá dentro de los plazos legalmente aplicables.

Los conductores conservan, además, los derechos específicos de acceso y portabilidad reconocidos por la normativa de plataformas digitales, incluyendo el acceso a datos relacionados con calificaciones que impacten su desempeño.

15. Eliminación de cuenta

La eliminación puede iniciarse dentro de la App y en api.rapago.cl/eliminar-cuenta. El motivo es opcional. El proceso se completará dentro de treinta días desde la verificación, salvo aplazamiento objetivo por viaje/reserva activa, saldo o devolución pendiente, reclamo, contracargo, fraude o deber legal.

La conservación de registros mínimos no mantendrá activa la cuenta. Si la cuenta utiliza Sign in with Apple, se revocarán los tokens al ejecutar la eliminación.

16. Comunicaciones por WhatsApp y correo

Si la persona contacta a Rapa Go mediante WhatsApp, Meta/WhatsApp tratará el número, nombre de perfil, contenido y metadatos conforme a sus propias políticas. Rapa Go utilizará la conversación para soporte, seguridad, reclamos y evidencia cuando sea necesario.

Los correos transaccionales se utilizan para registro, recuperación, pagos, documentación, soporte y avisos legales. Las comunicaciones comerciales se gestionan separadamente y pueden cancelarse en cualquier momento.

17. Menores de edad

La versión inicial no permite que menores creen cuentas ni soliciten viajes por sí solos. Rapa Go no dirige intencionalmente sus servicios a menores ni pretende recopilar directamente sus datos fuera de los antecedentes estrictamente necesarios cuando viajen acompañados por un adulto responsable.

18. Cambios a la Política

Rapa Go podrá actualizar esta Política por cambios legales, tecnológicos, de proveedores o de operación. Las modificaciones materiales se informarán por la App, correo u otro canal adecuado y se solicitará nueva aceptación o consentimiento cuando sea legalmente necesario.

19. Contacto

Responsable: Haka Taiko SpA, RUT 77.930.635-6. Domicilio: Miru s/n, Isla de Pascua, Chile. Privacidad: privacidad@rapago.cl. Eliminación: api.rapago.cl/eliminar-cuenta. Soporte: soporte@rapago.cl y Centro de Ayuda. Comunicaciones legales: legal@rapago.cl.
$rapago_privacy_v10$,
      '2026-08-13',
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO target_id;
  ELSE
    UPDATE legal_documents
    SET title = 'Política de Privacidad y Tratamiento de Datos Personales',
        effective_date = '2026-08-13',
        is_active = true,
        updated_at = NOW()
    WHERE id = target_id;
  END IF;

  UPDATE legal_documents
  SET is_active = (id = target_id),
      updated_at = CASE
        WHEN id = target_id OR is_active = true THEN NOW()
        ELSE updated_at
      END
  WHERE type = 'privacy_policy';
END
$publish_rapago_privacy_v10$;

DO $publish_rapago_driver_v21$
DECLARE
  target_id uuid;
BEGIN
  SELECT id
  INTO target_id
  FROM legal_documents
  WHERE type = 'driver_conditions'
    AND version = '2.1'
    AND content = $rapago_driver_v21$RAPA GO

CONTRATO DE PRESTACIÓN DE SERVICIOS

Conductor independiente de plataforma digital

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 2.1

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Contrato aplicable exclusivamente a conductores personas naturales. Las empresas operadoras requieren un contrato comercial separado. La habilitación efectiva exige validación documental, capacitación, franja de desconexión, aceptación electrónica, disponibilidad del contrato en la App y cumplimiento de las coberturas y demás obligaciones legales vigentes.

COMPARECENCIA

Entre HAKA TAIKO SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, Isla de Pascua, Chile, representada para estos efectos por quien cuente con facultades vigentes, en adelante ‘Rapa Go’, la ‘Plataforma’ o la ‘Empresa’; y la persona natural individualizada en el Anexo N.º 1, en adelante el ‘Conductor’ o el ‘Prestador’, se celebra el presente Contrato de Prestación de Servicios de Conductor Independiente de Plataforma Digital.

El Conductor declara que los antecedentes incorporados en la App y anexos son auténticos, vigentes y verificables y que mantiene domicilio efectivo y residencia tributaria acreditada en Rapa Nui.

1. Objeto y naturaleza independiente

El Conductor prestará personalmente servicios de movilidad solicitados mediante la App, utilizando un vehículo validado. Rapa Go coordina tecnológicamente el contacto, informa tarifas, procesa o registra pagos y brinda soporte.

El Conductor organiza libremente su disponibilidad, sin exclusividad, turnos obligatorios, mínimo de conexión o viajes. Puede prestar servicios para terceros. La calificación jurídica dependerá de la ejecución real y de la legislación vigente.

2. Territorio y requisitos de incorporación

El servicio se prestará exclusivamente en Rapa Nui. El Conductor deberá ser mayor de dieciocho años y mantener domicilio y residencia tributaria acreditados en el territorio.

Podrán incorporarse personas pertenecientes al Pueblo Rapa Nui, personas legalmente habilitadas para residir y desarrollar actividades económicas y conductores de taxis formalmente autorizados, todos sujetos a requisitos uniformes de seguridad, documentación, residencia tributaria y capacitación.

El padre o madre de una persona rapanui deberá aportar certificado de nacimiento y acreditar su propia habilitación territorial. El apellido será un antecedente indicativo y no acreditación suficiente por sí solo.

3. Documentación

El Conductor deberá mantener cédula, licencia de conducir de la clase legalmente habilitante para la actividad efectivamente realizada, permiso de circulación, antecedentes, inhabilidades, residencia y documentos tributarios vigentes. Aunque no se carguen separadamente, deberá mantener SOAP y revisión técnica o homologación cuando correspondan.

Deberá informar dentro de veinticuatro horas todo vencimiento, suspensión, pérdida o modificación relevante. Rapa Go podrá bloquear automáticamente por documentos esenciales vencidos o irregulares.

4. Vehículo y conducción personal

Solo podrán utilizarse vehículos registrados. Un vehículo puede asociarse a varios conductores, pero cada persona debe estar individualmente habilitada. Si el vehículo pertenece a un tercero, se exigirá autorización simple; las empresas operadoras deberán acreditar propiedad, arrendamiento o autorización. Se prohíbe absolutamente que conduzca una persona no registrada.

5. Estándares del vehículo

El vehículo deberá mantenerse limpio, seguro y apto para pasajeros, con cinturones, puertas, luces, neumáticos, vidrios y asientos en condiciones. Rapa Go podrá inspeccionar y suspender el vehículo hasta corregir deficiencias.

6. Cuenta y autenticación

La cuenta es personal e intransferible. El acceso podrá realizarse mediante correo electrónico y contraseña, Google y, en iOS, Sign in with Apple. Facebook no forma parte de la versión de lanzamiento.

Las identidades se vincularán a un único userId y no se fusionarán solo por coincidencia de correo. El Conductor protegerá sus credenciales y reportará accesos no autorizados.

7. Asignación algorítmica

Las ofertas serán asignadas exclusivamente por algoritmo, a un conductor por vez, considerando proximidad, disponibilidad, categoría, capacidad, equipaje, modalidad y compatibilidad técnica.

La calificación se utilizará para control de calidad y no como criterio automático de asignación. La tasa histórica de rechazo antes de aceptar se excluirá del algoritmo. No existirá asignación manual ordinaria.

8. Información previa y rechazo libre

Antes de aceptar, el Conductor verá identificador del pasajero, origen, destino, categoría, medio de pago, tarifa total al pasajero y requerimientos especiales. La tarifa específica se expresará en pesos chilenos en cada oferta. Conforme a la Comisión pactada, el Conductor podrá determinar su participación ordinaria sobre dicha tarifa.

El rechazo antes de aceptar será libre, no requerirá causa y no generará sanción, pérdida de prioridad, suspensión ni afectación de continuidad.

9. Categorías

Las categorías iniciales serán Estándar, XL, Maletas y Express/Prioritario. El Conductor podrá elegir las compatibles con su vehículo. Confort, Encomiendas, Tours, Rent a Car y Eventos permanecerán desactivados hasta habilitación expresa.

10. Conexión y obligación posterior

El Conductor podrá conectarse y desconectarse sin aviso, respetando la franja de desconexión. Una vez aceptado, deberá ejecutar diligentemente o justificar cancelación por accidente, falla, emergencia, riesgo, camino bloqueado o fuerza mayor. La cancelación quedará registrada con motivo y evidencia disponible.

11. Desconexión mínima

Rapa Go resguardará doce horas continuas de desconexión dentro de cada período de veinticuatro horas. El Conductor elegirá una franja diaria y podrá modificarla mediante conductores@rapago.cl con veinticuatro horas de anticipación.

Durante la franja no se enviarán ofertas. Si existe un viaje en curso, podrá finalizarlo y luego comenzará el bloqueo automático o administrativo registrado. La desconexión destinada a hacer efectivo este derecho no constituye sanción.

12. Conducta, cultura y privacidad del pasajero

El Conductor deberá mantener trato respetuoso, no discriminatorio y profesional; respetar cultura y patrimonio Rapa Nui; y usar los datos del pasajero únicamente para ejecutar el viaje. Se prohíbe conservar o usar datos para contacto posterior, captar servicios fuera de la App, ofrecer tours no habilitados o promover ingreso a zonas restringidas.

13. Tarifa, Comisión e ingreso

Rapa Go determina la tarifa conforme a variables operativas y comerciales informadas en la App, pudiendo considerar distancia, categoría, demanda, disponibilidad, reserva, modalidad Express, promociones y demás condiciones previamente configuradas. El valor concreto de cada servicio se informará en pesos chilenos al Conductor antes de su aceptación.

La Comisión total de Rapa Go será equivalente al veintitrés por ciento (23%) de la tarifa total del servicio, IVA incluido. El Conductor tendrá derecho al setenta y siete por ciento (77%) restante, antes del tratamiento tributario aplicable.

La Comisión se aplicará a recargos Express. Las promociones financiadas por Rapa Go no reducirán retroactivamente el monto derivado de la tarifa ofrecida al momento de aceptar.

14. Incentivos

Rapa Go podrá ofrecer campañas voluntarias con pagos monetarios, viajes u otros beneficios. Cada campaña informará vigencia, destinatarios, condiciones, valor o forma de cálculo y restricciones. No constituyen derecho permanente ni pueden utilizarse para sancionar el rechazo o la falta de conexión.

15. Cancelación y No Show

Si el pasajero cancela antes de cumplirse íntegramente un minuto desde la asignación confirmada del Conductor, no existirá cargo al pasajero. Transcurrido dicho minuto podrá aplicarse un cargo equivalente al 30% del valor total del viaje, con tope de $3.000.

Si, tratándose de una cancelación con cargo, el Conductor ya llegó al punto de retiro y la llegada es verificable, el 50% del monto efectivamente cobrado corresponderá al Conductor y el 50% a Rapa Go, sin Comisión adicional sobre la participación del Conductor.

En No Show, el pasajero podrá ser cargado con 50% del viaje, tope $5.000, siempre que el Conductor registre llegada y espere cinco minutos. El cargo efectivamente cobrado se distribuirá 50% para el Conductor y 50% para Rapa Go, sin Comisión adicional sobre la participación del Conductor.

No habrá participación del Conductor cuando no exista llegada verificable o el cargo sea anulado por causa imputable al Conductor o a la Plataforma.

16. Tiempo efectivo y honorario mínimo

El tiempo efectivo comienza cuando el Conductor acepta el servicio y comienza el desplazamiento para ejecutarlo y finaliza cuando completa el servicio y el sistema valida su término. En cancelaciones posteriores se registrará el tiempo entre aceptación y cancelación; si la cancelación es imputable al Conductor podrá excluirse mediante decisión fundada.

Rapa Go verificará, dentro de cada período de pago, que los honorarios por hora de servicios efectivamente realizados no sean inferiores a la proporción del ingreso mínimo mensual determinado por ley, incrementada en un veinte por ciento. El cálculo utilizará el divisor legal vigente conforme a la implementación gradual de la jornada legal; a la fecha de esta versión corresponde a 174 horas. Si el mínimo no se alcanza, Rapa Go pagará la diferencia.

Soporte y Contabilidad efectuarán la verificación en cada período semanal de pago y el administrador podrá remitir un informe consolidado mensual.

17. Liquidaciones y pagos

El período será semanal, lunes a domingo, con cierre el domingo a las 23:59 horas de Rapa Nui y transferencia el lunes o día hábil inmediato. La liquidación detallará viajes, tarifa, medio, Comisión, cancelaciones, No Show, ajustes, tratamiento tributario, saldos y total.

El Conductor podrá objetar dentro de cinco días hábiles; la objeción suspenderá únicamente el monto controvertido y no el pago de la parte no discutida.

18. Efectivo y saldos adeudados

En efectivo, el Conductor recibe el pago y queda registrada la Comisión. Los saldos se compensarán con liquidaciones futuras. Si no existen fondos suficientes o termina el contrato, deberá transferir a Haka Taiko SpA dentro de tres días hábiles desde el requerimiento.

Los datos bancarios se informarán por canales oficiales y el comprobante se enviará a pagos@rapago.cl. Un saldo vencido por más de tres días hábiles o mantenido durante dos períodos consecutivos podrá originar suspensión temporal hasta su regularización, sin perjuicio del derecho a objetar.

19. Documentación tributaria

El Conductor emitirá una boleta mensual a Haka Taiko SpA que documentará todos los pagos semanales del mes. Se emitirá el primer día hábil del mes siguiente; habrá un plazo adicional de tres días y luego podrá suspenderse la cuenta hasta regularización.

La retención, exención o tratamiento tributario se aplicará según la residencia tributaria acreditada y normativa vigente. El Conductor deberá informar cualquier cambio.

20. Datos personales y acceso

Rapa Go tratará datos para registro, asignación, pagos, seguridad, soporte, fraude, investigación y cumplimiento conforme a la Política de Privacidad. Cuando corresponda acreditar pertenencia al Pueblo Rapa Nui o vínculos familiares, la Empresa tratará datos sensibles únicamente con consentimiento expreso y para la finalidad de habilitación declarada.

El historial de viajes y calificaciones estará en la App. Contrato, liquidaciones y horas podrán enviarse por correo. El contrato vigente permanecerá visible o descargable dentro de la cuenta.

El Conductor podrá solicitar acceso y portabilidad a privacidad@rapago.cl; cuando no exista descarga automática, se responderá dentro de quince días hábiles, sin perjuicio de plazos más favorables establecidos por la legislación aplicable.

21. Geolocalización

La ubicación podrá tratarse durante disponibilidad, asignación y viaje. La última coordenada previa se conservará hasta quince minutos. Durante un viaje activo podrá continuar en segundo plano y terminará al completar, cancelar, cerrar sesión o revocar permiso.

Las rutas ordinarias podrán conservarse hasta un año; accidentes, fraude, reclamos o investigaciones hasta cinco años o el plazo legal aplicable.

22. Algoritmo y revisión humana

Los mecanismos automatizados no utilizarán pertenencia étnica, nacionalidad, rechazo previo ni falta de conexión como factores sancionatorios. Cuando una decisión afecte continuidad, el Conductor podrá conocer fundamentos esenciales y solicitar revisión humana, resguardando datos de terceros.

23. Calificaciones

Una baja calificación no producirá suspensión automática. Soporte revisará contexto, número de viajes, reclamos y comentarios privados y podrá adoptar capacitación, advertencia o investigación.

24. Canal de reclamos del Conductor

El canal oficial será conductores@rapago.cl, el teléfono local +56 9 4796 4171 y el lugar físico de atención Miru s/n, Isla de Pascua. El canal contará con un representante de la Empresa asignado como responsable; la identidad del titular y su suplente, junto con el horario vigente o mecanismo de coordinación presencial, se informarán mediante ficha disponible en la App y por correo antes de la habilitación efectiva del Conductor.

Rapa Go acusará recibo y procurará responder asuntos simples en tres días hábiles, complejos en cinco e investigaciones en diez, prorrogables fundadamente.

25. Investigación, suspensión y apelación

Ante posible incumplimiento se notificará y otorgarán cuarenta y ocho horas para descargos, salvo riesgo grave que justifique suspensión preventiva inmediata. Soporte/Administrador resolverá fundadamente; el Conductor podrá apelar en tres días hábiles y Gerencia Legal resolverá.

Los montos devengados seguirán pagándose salvo aquellos directamente vinculados a fraude o controversia documentada.

26. Cancelaciones injustificadas

Cada tres cancelaciones injustificadas posteriores a la aceptación dentro de treinta días móviles podrán originar: primera ocurrencia, suspensión de siete días; segunda, treinta días; tercera, terminación. No se considerarán injustificadas las cancelaciones por accidente, falla, emergencia, riesgo, bloqueo de camino, fuerza mayor u otra causa objetiva.

27. Incumplimientos graves

Podrán constituir incumplimientos graves: documentación falsa; conductor no autorizado; licencia vencida, suspendida o cancelada; fraude; manipulación de pagos; agresión, acoso, amenaza o discriminación; accidente grave no informado; captación reiterada para eludir la App; cobros externos; uso indebido de datos; transporte inseguro; daño cultural o patrimonial grave; reincidencia posterior a suspensiones; y otros incumplimientos legales graves. La decisión será fundada y reclamable.

28. Terminación

El Conductor podrá terminar mediante correo a conductores@rapago.cl sin aviso previo obligatorio. Rapa Go notificará con treinta días de anticipación cuando el Conductor haya prestado servicios continuos por seis meses o más, salvo que el término se funde en un incumplimiento grave contractual.

La terminación no impedirá el pago de honorarios devengados ni devolución de saldos.

29. Accidentes e incidentes

El Conductor priorizará la seguridad, contactará servicios públicos y reportará a Rapa Go. Enviará ubicación, fotografías, patente, relato y parte policial cuando exista.

Un accidente grave podrá producir suspensión preventiva. El Conductor asumirá el reembolso al pasajero cuando la imposibilidad de completar el servicio sea imputable a su conducta o vehículo, previa determinación fundada. El Conductor responde por conducción y cumplimiento de la Ley de Tránsito, sin perjuicio de responsabilidades propias de Haka Taiko SpA.

30. Capacitación

Antes de activarse deberá aprobar capacitación sobre App, seguridad vial, privacidad, trato, prevención de acoso, accidentes, objetos olvidados, cultura y patrimonio Rapa Nui, pagos y baja conectividad. La capacitación se actualizará cuando cambien protocolos relevantes.

31. Seguro de daños sobre bienes utilizados

Rapa Go proporcionará el seguro de daños sobre los bienes personales que utilice el Conductor en la prestación del servicio que resulte exigido por la legislación vigente, con la cobertura mínima legal aplicable.

La individualización del asegurador, póliza, bienes cubiertos, exclusiones, vigencia, procedimiento de siniestro y demás condiciones se incorporará mediante un anexo específico antes de la habilitación efectiva del Conductor. La aceptación de este contrato no constituye declaración de que una póliza determinada se encuentre vigente mientras dicho anexo no haya sido emitido y comunicado.

32. Propiedad intelectual y uso de la App

Rapa Go concede licencia personal, revocable, no exclusiva e intransferible durante la vigencia. Se prohíbe copiar, descompilar, extraer datos, manipular geolocalización, tarifas o controles.

33. Confidencialidad y desintermediación

El Conductor usará datos del pasajero solo para el viaje y no podrá contactarlo posteriormente sin causa legítima, compartir datos, cobrar precio distinto ni captar servicios para eludir Comisión, trazabilidad o seguridad.

34. Fuerza mayor y conectividad

La operación depende de internet, GPS, energía, clima, caminos y servicios de terceros. La falla temporal no autoriza cobros no informados ni elimina el deber de reportar incidentes.

35. Cesión

El Conductor autoriza anticipadamente que Haka Taiko SpA ceda su posición contractual a RAPA GO SPA cuando se encuentre legal, tributaria y operativamente habilitada. La cesión será notificada por correo y App, mantendrá continuidad de registros y no afectará derechos devengados. Toda modificación material adicional requerirá aceptación expresa.

36. Modificaciones y campañas

Las modificaciones materiales serán informadas y aceptadas electrónicamente. Datos de contacto, responsables, campañas temporales y cambios que no alteren derechos esenciales podrán comunicarse mediante fichas o avisos.

37. Aceptación, entrega y disponibilidad

El Conductor aceptará mediante casilla no preseleccionada y botón ‘Acepto el Contrato de Prestación de Servicios’. El sistema registrará, a lo menos, versión, fecha, hora y usuario.

Rapa Go enviará una copia PDF al correo y mantendrá el contrato disponible para ver o descargar dentro de la cuenta en cualquier momento. La habilitación solo ocurrirá después de validación y condiciones previas.

38. Cierre de cuenta y conservación

El Conductor podrá solicitar cierre desde la App o canal oficial. Podrá aplazarse por viajes activos, saldo, boleta pendiente, investigación o deber de conservación. El cierre no extingue obligaciones ni pagos. Contratos, aceptaciones, liquidaciones, reclamos e incidentes podrán conservarse hasta cinco años o el plazo legal aplicable.

39. Domicilio para notificaciones, ley aplicable y competencia

Para los efectos de comunicaciones y notificaciones judiciales, administrativas o de naturaleza análoga, Rapa Go designa domicilio en Miru s/n, Isla de Pascua, Chile. El contrato se rige por las leyes chilenas y la competencia será la determinada legalmente, sin limitar derechos o acciones irrenunciables.

40. Integridad

El contrato y sus anexos contienen el acuerdo aplicable al Conductor persona natural. La nulidad de una cláusula no afecta las restantes. Las empresas operadoras deberán celebrar un contrato comercial separado.

ANEXO N.º 1 · INDIVIDUALIZACIÓN DEL CONDUCTOR

Nombre completo |

RUT |

Fecha de nacimiento |

Domicilio en Rapa Nui |

Correo |

Teléfono |

Banco / cuenta |

Domicilio tributario acreditado | Sí / No

Calidad territorial |

Documento de respaldo |

Vehículo asociado

Patente |

Marca / modelo |

Año |

Color |

Titular |

Permiso de circulación vence |

Categorías |

ANEXO N.º 2 · CONDICIONES ECONÓMICAS

Materia | Condición

Comisión | 23% de la tarifa total, IVA incluido.

Participación ordinaria | 77% antes del tratamiento tributario.

Express/Prioritario | La Comisión se aplica a la tarifa total incluido el recargo.

Cancelación ordinaria | Sin cargo antes de 1 minuto desde la asignación confirmada. Luego: 30% del viaje, tope $3.000. Si el Conductor llegó y el cargo se cobra: 50% Conductor / 50% Rapa Go.

No Show | 50% del viaje, tope $5.000, tras llegada y 5 minutos. 50% Conductor / 50% Rapa Go.

Liquidación | Semanal, lunes a domingo; transferencia lunes siguiente.

Objeción | 5 días hábiles.

Boleta | Mensual, primer día hábil; 3 días adicionales.

Saldo adeudado | Compensación o transferencia en 3 días hábiles.

ANEXO N.º 3 · FRANJA DE DESCONEXIÓN

Hora de inicio |

Hora de término |

Fecha desde la que rige |

Observaciones |

La modificación deberá solicitarse a conductores@rapago.cl con al menos veinticuatro horas de anticipación.

ANEXO N.º 4 · DOCUMENTOS, DECLARACIONES Y CONSENTIMIENTO SENSIBLE

[ ] Cédula vigente.

[ ] Licencia de conducir vigente.

[ ] Permiso de circulación vigente.

[ ] Certificado de antecedentes de hasta 30 días.

[ ] Verificación de inhabilidades.

[ ] Fotografía.

[ ] Datos bancarios.

[ ] Residencia y domicilio tributario en Rapa Nui.

[ ] Declaración de pertenencia rapanui o habilitación territorial, cuando corresponda.

[ ] Certificado de nacimiento del hijo o hija rapanui cuando corresponda.

[ ] Autorización de uso si el vehículo es de tercero.

El Conductor consiente expresamente el tratamiento de datos sensibles relativos a pertenencia al Pueblo Rapa Nui y de antecedentes familiares que voluntariamente proporcione para acreditar la habilitación aplicable, exclusivamente para fines de evaluación, habilitación, cumplimiento, auditoría y defensa jurídica, conforme a la Política de Privacidad.

ANEXO N.º 5 · CANAL DE RECLAMOS

Correo | conductores@rapago.cl

Teléfono local | +56 9 4796 4171

Lugar físico | Miru s/n, Isla de Pascua

Representante titular | Encargado de Gestión de Reclamos de Conductores; nombre informado en ficha vigente antes de habilitación.

Representante suplente | Integrante suplente del equipo; nombre informado en ficha vigente.

Primera instancia | Soporte / Administrador de la App

Apelación | Gerencia Legal

ANEXO N.º 6 · REGISTRO DE ACEPTACIÓN

Versión | 2.1

Identificador del Conductor |

Fecha y hora |

Usuario/cuenta |

Correo de envío PDF |

Contrato disponible en App | Sí / No

Capacitación aprobada | Sí / No

Validación documental | Sí / No

Consentimiento datos sensibles | Sí / No / No aplica

Anexo de seguro emitido | Sí / No

Representante de reclamos designado | Sí / No

Habilitación efectiva | Sí / No

DECLARACIÓN DE ACEPTACIÓN Al seleccionar “Acepto el Contrato de Prestación de Servicios”, el Conductor declara haber leído y comprendido el contrato y anexos, confirma la veracidad de sus antecedentes, presta los consentimientos específicos que correspondan y reconoce que la habilitación depende de las condiciones previas.
$rapago_driver_v21$
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF target_id IS NULL THEN
    INSERT INTO legal_documents (
      type, version, title, content, effective_date, is_active, created_at, updated_at
    )
    VALUES (
      'driver_conditions',
      '2.1',
      'Contrato de Prestación de Servicios de Conductor Independiente',
      $rapago_driver_v21$RAPA GO

CONTRATO DE PRESTACIÓN DE SERVICIOS

Conductor independiente de plataforma digital

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 2.1

Fecha | 13 de agosto de 2026

NATURALEZA DEL DOCUMENTO Contrato aplicable exclusivamente a conductores personas naturales. Las empresas operadoras requieren un contrato comercial separado. La habilitación efectiva exige validación documental, capacitación, franja de desconexión, aceptación electrónica, disponibilidad del contrato en la App y cumplimiento de las coberturas y demás obligaciones legales vigentes.

COMPARECENCIA

Entre HAKA TAIKO SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, Isla de Pascua, Chile, representada para estos efectos por quien cuente con facultades vigentes, en adelante ‘Rapa Go’, la ‘Plataforma’ o la ‘Empresa’; y la persona natural individualizada en el Anexo N.º 1, en adelante el ‘Conductor’ o el ‘Prestador’, se celebra el presente Contrato de Prestación de Servicios de Conductor Independiente de Plataforma Digital.

El Conductor declara que los antecedentes incorporados en la App y anexos son auténticos, vigentes y verificables y que mantiene domicilio efectivo y residencia tributaria acreditada en Rapa Nui.

1. Objeto y naturaleza independiente

El Conductor prestará personalmente servicios de movilidad solicitados mediante la App, utilizando un vehículo validado. Rapa Go coordina tecnológicamente el contacto, informa tarifas, procesa o registra pagos y brinda soporte.

El Conductor organiza libremente su disponibilidad, sin exclusividad, turnos obligatorios, mínimo de conexión o viajes. Puede prestar servicios para terceros. La calificación jurídica dependerá de la ejecución real y de la legislación vigente.

2. Territorio y requisitos de incorporación

El servicio se prestará exclusivamente en Rapa Nui. El Conductor deberá ser mayor de dieciocho años y mantener domicilio y residencia tributaria acreditados en el territorio.

Podrán incorporarse personas pertenecientes al Pueblo Rapa Nui, personas legalmente habilitadas para residir y desarrollar actividades económicas y conductores de taxis formalmente autorizados, todos sujetos a requisitos uniformes de seguridad, documentación, residencia tributaria y capacitación.

El padre o madre de una persona rapanui deberá aportar certificado de nacimiento y acreditar su propia habilitación territorial. El apellido será un antecedente indicativo y no acreditación suficiente por sí solo.

3. Documentación

El Conductor deberá mantener cédula, licencia de conducir de la clase legalmente habilitante para la actividad efectivamente realizada, permiso de circulación, antecedentes, inhabilidades, residencia y documentos tributarios vigentes. Aunque no se carguen separadamente, deberá mantener SOAP y revisión técnica o homologación cuando correspondan.

Deberá informar dentro de veinticuatro horas todo vencimiento, suspensión, pérdida o modificación relevante. Rapa Go podrá bloquear automáticamente por documentos esenciales vencidos o irregulares.

4. Vehículo y conducción personal

Solo podrán utilizarse vehículos registrados. Un vehículo puede asociarse a varios conductores, pero cada persona debe estar individualmente habilitada. Si el vehículo pertenece a un tercero, se exigirá autorización simple; las empresas operadoras deberán acreditar propiedad, arrendamiento o autorización. Se prohíbe absolutamente que conduzca una persona no registrada.

5. Estándares del vehículo

El vehículo deberá mantenerse limpio, seguro y apto para pasajeros, con cinturones, puertas, luces, neumáticos, vidrios y asientos en condiciones. Rapa Go podrá inspeccionar y suspender el vehículo hasta corregir deficiencias.

6. Cuenta y autenticación

La cuenta es personal e intransferible. El acceso podrá realizarse mediante correo electrónico y contraseña, Google y, en iOS, Sign in with Apple. Facebook no forma parte de la versión de lanzamiento.

Las identidades se vincularán a un único userId y no se fusionarán solo por coincidencia de correo. El Conductor protegerá sus credenciales y reportará accesos no autorizados.

7. Asignación algorítmica

Las ofertas serán asignadas exclusivamente por algoritmo, a un conductor por vez, considerando proximidad, disponibilidad, categoría, capacidad, equipaje, modalidad y compatibilidad técnica.

La calificación se utilizará para control de calidad y no como criterio automático de asignación. La tasa histórica de rechazo antes de aceptar se excluirá del algoritmo. No existirá asignación manual ordinaria.

8. Información previa y rechazo libre

Antes de aceptar, el Conductor verá identificador del pasajero, origen, destino, categoría, medio de pago, tarifa total al pasajero y requerimientos especiales. La tarifa específica se expresará en pesos chilenos en cada oferta. Conforme a la Comisión pactada, el Conductor podrá determinar su participación ordinaria sobre dicha tarifa.

El rechazo antes de aceptar será libre, no requerirá causa y no generará sanción, pérdida de prioridad, suspensión ni afectación de continuidad.

9. Categorías

Las categorías iniciales serán Estándar, XL, Maletas y Express/Prioritario. El Conductor podrá elegir las compatibles con su vehículo. Confort, Encomiendas, Tours, Rent a Car y Eventos permanecerán desactivados hasta habilitación expresa.

10. Conexión y obligación posterior

El Conductor podrá conectarse y desconectarse sin aviso, respetando la franja de desconexión. Una vez aceptado, deberá ejecutar diligentemente o justificar cancelación por accidente, falla, emergencia, riesgo, camino bloqueado o fuerza mayor. La cancelación quedará registrada con motivo y evidencia disponible.

11. Desconexión mínima

Rapa Go resguardará doce horas continuas de desconexión dentro de cada período de veinticuatro horas. El Conductor elegirá una franja diaria y podrá modificarla mediante conductores@rapago.cl con veinticuatro horas de anticipación.

Durante la franja no se enviarán ofertas. Si existe un viaje en curso, podrá finalizarlo y luego comenzará el bloqueo automático o administrativo registrado. La desconexión destinada a hacer efectivo este derecho no constituye sanción.

12. Conducta, cultura y privacidad del pasajero

El Conductor deberá mantener trato respetuoso, no discriminatorio y profesional; respetar cultura y patrimonio Rapa Nui; y usar los datos del pasajero únicamente para ejecutar el viaje. Se prohíbe conservar o usar datos para contacto posterior, captar servicios fuera de la App, ofrecer tours no habilitados o promover ingreso a zonas restringidas.

13. Tarifa, Comisión e ingreso

Rapa Go determina la tarifa conforme a variables operativas y comerciales informadas en la App, pudiendo considerar distancia, categoría, demanda, disponibilidad, reserva, modalidad Express, promociones y demás condiciones previamente configuradas. El valor concreto de cada servicio se informará en pesos chilenos al Conductor antes de su aceptación.

La Comisión total de Rapa Go será equivalente al veintitrés por ciento (23%) de la tarifa total del servicio, IVA incluido. El Conductor tendrá derecho al setenta y siete por ciento (77%) restante, antes del tratamiento tributario aplicable.

La Comisión se aplicará a recargos Express. Las promociones financiadas por Rapa Go no reducirán retroactivamente el monto derivado de la tarifa ofrecida al momento de aceptar.

14. Incentivos

Rapa Go podrá ofrecer campañas voluntarias con pagos monetarios, viajes u otros beneficios. Cada campaña informará vigencia, destinatarios, condiciones, valor o forma de cálculo y restricciones. No constituyen derecho permanente ni pueden utilizarse para sancionar el rechazo o la falta de conexión.

15. Cancelación y No Show

Si el pasajero cancela antes de cumplirse íntegramente un minuto desde la asignación confirmada del Conductor, no existirá cargo al pasajero. Transcurrido dicho minuto podrá aplicarse un cargo equivalente al 30% del valor total del viaje, con tope de $3.000.

Si, tratándose de una cancelación con cargo, el Conductor ya llegó al punto de retiro y la llegada es verificable, el 50% del monto efectivamente cobrado corresponderá al Conductor y el 50% a Rapa Go, sin Comisión adicional sobre la participación del Conductor.

En No Show, el pasajero podrá ser cargado con 50% del viaje, tope $5.000, siempre que el Conductor registre llegada y espere cinco minutos. El cargo efectivamente cobrado se distribuirá 50% para el Conductor y 50% para Rapa Go, sin Comisión adicional sobre la participación del Conductor.

No habrá participación del Conductor cuando no exista llegada verificable o el cargo sea anulado por causa imputable al Conductor o a la Plataforma.

16. Tiempo efectivo y honorario mínimo

El tiempo efectivo comienza cuando el Conductor acepta el servicio y comienza el desplazamiento para ejecutarlo y finaliza cuando completa el servicio y el sistema valida su término. En cancelaciones posteriores se registrará el tiempo entre aceptación y cancelación; si la cancelación es imputable al Conductor podrá excluirse mediante decisión fundada.

Rapa Go verificará, dentro de cada período de pago, que los honorarios por hora de servicios efectivamente realizados no sean inferiores a la proporción del ingreso mínimo mensual determinado por ley, incrementada en un veinte por ciento. El cálculo utilizará el divisor legal vigente conforme a la implementación gradual de la jornada legal; a la fecha de esta versión corresponde a 174 horas. Si el mínimo no se alcanza, Rapa Go pagará la diferencia.

Soporte y Contabilidad efectuarán la verificación en cada período semanal de pago y el administrador podrá remitir un informe consolidado mensual.

17. Liquidaciones y pagos

El período será semanal, lunes a domingo, con cierre el domingo a las 23:59 horas de Rapa Nui y transferencia el lunes o día hábil inmediato. La liquidación detallará viajes, tarifa, medio, Comisión, cancelaciones, No Show, ajustes, tratamiento tributario, saldos y total.

El Conductor podrá objetar dentro de cinco días hábiles; la objeción suspenderá únicamente el monto controvertido y no el pago de la parte no discutida.

18. Efectivo y saldos adeudados

En efectivo, el Conductor recibe el pago y queda registrada la Comisión. Los saldos se compensarán con liquidaciones futuras. Si no existen fondos suficientes o termina el contrato, deberá transferir a Haka Taiko SpA dentro de tres días hábiles desde el requerimiento.

Los datos bancarios se informarán por canales oficiales y el comprobante se enviará a pagos@rapago.cl. Un saldo vencido por más de tres días hábiles o mantenido durante dos períodos consecutivos podrá originar suspensión temporal hasta su regularización, sin perjuicio del derecho a objetar.

19. Documentación tributaria

El Conductor emitirá una boleta mensual a Haka Taiko SpA que documentará todos los pagos semanales del mes. Se emitirá el primer día hábil del mes siguiente; habrá un plazo adicional de tres días y luego podrá suspenderse la cuenta hasta regularización.

La retención, exención o tratamiento tributario se aplicará según la residencia tributaria acreditada y normativa vigente. El Conductor deberá informar cualquier cambio.

20. Datos personales y acceso

Rapa Go tratará datos para registro, asignación, pagos, seguridad, soporte, fraude, investigación y cumplimiento conforme a la Política de Privacidad. Cuando corresponda acreditar pertenencia al Pueblo Rapa Nui o vínculos familiares, la Empresa tratará datos sensibles únicamente con consentimiento expreso y para la finalidad de habilitación declarada.

El historial de viajes y calificaciones estará en la App. Contrato, liquidaciones y horas podrán enviarse por correo. El contrato vigente permanecerá visible o descargable dentro de la cuenta.

El Conductor podrá solicitar acceso y portabilidad a privacidad@rapago.cl; cuando no exista descarga automática, se responderá dentro de quince días hábiles, sin perjuicio de plazos más favorables establecidos por la legislación aplicable.

21. Geolocalización

La ubicación podrá tratarse durante disponibilidad, asignación y viaje. La última coordenada previa se conservará hasta quince minutos. Durante un viaje activo podrá continuar en segundo plano y terminará al completar, cancelar, cerrar sesión o revocar permiso.

Las rutas ordinarias podrán conservarse hasta un año; accidentes, fraude, reclamos o investigaciones hasta cinco años o el plazo legal aplicable.

22. Algoritmo y revisión humana

Los mecanismos automatizados no utilizarán pertenencia étnica, nacionalidad, rechazo previo ni falta de conexión como factores sancionatorios. Cuando una decisión afecte continuidad, el Conductor podrá conocer fundamentos esenciales y solicitar revisión humana, resguardando datos de terceros.

23. Calificaciones

Una baja calificación no producirá suspensión automática. Soporte revisará contexto, número de viajes, reclamos y comentarios privados y podrá adoptar capacitación, advertencia o investigación.

24. Canal de reclamos del Conductor

El canal oficial será conductores@rapago.cl, el teléfono local +56 9 4796 4171 y el lugar físico de atención Miru s/n, Isla de Pascua. El canal contará con un representante de la Empresa asignado como responsable; la identidad del titular y su suplente, junto con el horario vigente o mecanismo de coordinación presencial, se informarán mediante ficha disponible en la App y por correo antes de la habilitación efectiva del Conductor.

Rapa Go acusará recibo y procurará responder asuntos simples en tres días hábiles, complejos en cinco e investigaciones en diez, prorrogables fundadamente.

25. Investigación, suspensión y apelación

Ante posible incumplimiento se notificará y otorgarán cuarenta y ocho horas para descargos, salvo riesgo grave que justifique suspensión preventiva inmediata. Soporte/Administrador resolverá fundadamente; el Conductor podrá apelar en tres días hábiles y Gerencia Legal resolverá.

Los montos devengados seguirán pagándose salvo aquellos directamente vinculados a fraude o controversia documentada.

26. Cancelaciones injustificadas

Cada tres cancelaciones injustificadas posteriores a la aceptación dentro de treinta días móviles podrán originar: primera ocurrencia, suspensión de siete días; segunda, treinta días; tercera, terminación. No se considerarán injustificadas las cancelaciones por accidente, falla, emergencia, riesgo, bloqueo de camino, fuerza mayor u otra causa objetiva.

27. Incumplimientos graves

Podrán constituir incumplimientos graves: documentación falsa; conductor no autorizado; licencia vencida, suspendida o cancelada; fraude; manipulación de pagos; agresión, acoso, amenaza o discriminación; accidente grave no informado; captación reiterada para eludir la App; cobros externos; uso indebido de datos; transporte inseguro; daño cultural o patrimonial grave; reincidencia posterior a suspensiones; y otros incumplimientos legales graves. La decisión será fundada y reclamable.

28. Terminación

El Conductor podrá terminar mediante correo a conductores@rapago.cl sin aviso previo obligatorio. Rapa Go notificará con treinta días de anticipación cuando el Conductor haya prestado servicios continuos por seis meses o más, salvo que el término se funde en un incumplimiento grave contractual.

La terminación no impedirá el pago de honorarios devengados ni devolución de saldos.

29. Accidentes e incidentes

El Conductor priorizará la seguridad, contactará servicios públicos y reportará a Rapa Go. Enviará ubicación, fotografías, patente, relato y parte policial cuando exista.

Un accidente grave podrá producir suspensión preventiva. El Conductor asumirá el reembolso al pasajero cuando la imposibilidad de completar el servicio sea imputable a su conducta o vehículo, previa determinación fundada. El Conductor responde por conducción y cumplimiento de la Ley de Tránsito, sin perjuicio de responsabilidades propias de Haka Taiko SpA.

30. Capacitación

Antes de activarse deberá aprobar capacitación sobre App, seguridad vial, privacidad, trato, prevención de acoso, accidentes, objetos olvidados, cultura y patrimonio Rapa Nui, pagos y baja conectividad. La capacitación se actualizará cuando cambien protocolos relevantes.

31. Seguro de daños sobre bienes utilizados

Rapa Go proporcionará el seguro de daños sobre los bienes personales que utilice el Conductor en la prestación del servicio que resulte exigido por la legislación vigente, con la cobertura mínima legal aplicable.

La individualización del asegurador, póliza, bienes cubiertos, exclusiones, vigencia, procedimiento de siniestro y demás condiciones se incorporará mediante un anexo específico antes de la habilitación efectiva del Conductor. La aceptación de este contrato no constituye declaración de que una póliza determinada se encuentre vigente mientras dicho anexo no haya sido emitido y comunicado.

32. Propiedad intelectual y uso de la App

Rapa Go concede licencia personal, revocable, no exclusiva e intransferible durante la vigencia. Se prohíbe copiar, descompilar, extraer datos, manipular geolocalización, tarifas o controles.

33. Confidencialidad y desintermediación

El Conductor usará datos del pasajero solo para el viaje y no podrá contactarlo posteriormente sin causa legítima, compartir datos, cobrar precio distinto ni captar servicios para eludir Comisión, trazabilidad o seguridad.

34. Fuerza mayor y conectividad

La operación depende de internet, GPS, energía, clima, caminos y servicios de terceros. La falla temporal no autoriza cobros no informados ni elimina el deber de reportar incidentes.

35. Cesión

El Conductor autoriza anticipadamente que Haka Taiko SpA ceda su posición contractual a RAPA GO SPA cuando se encuentre legal, tributaria y operativamente habilitada. La cesión será notificada por correo y App, mantendrá continuidad de registros y no afectará derechos devengados. Toda modificación material adicional requerirá aceptación expresa.

36. Modificaciones y campañas

Las modificaciones materiales serán informadas y aceptadas electrónicamente. Datos de contacto, responsables, campañas temporales y cambios que no alteren derechos esenciales podrán comunicarse mediante fichas o avisos.

37. Aceptación, entrega y disponibilidad

El Conductor aceptará mediante casilla no preseleccionada y botón ‘Acepto el Contrato de Prestación de Servicios’. El sistema registrará, a lo menos, versión, fecha, hora y usuario.

Rapa Go enviará una copia PDF al correo y mantendrá el contrato disponible para ver o descargar dentro de la cuenta en cualquier momento. La habilitación solo ocurrirá después de validación y condiciones previas.

38. Cierre de cuenta y conservación

El Conductor podrá solicitar cierre desde la App o canal oficial. Podrá aplazarse por viajes activos, saldo, boleta pendiente, investigación o deber de conservación. El cierre no extingue obligaciones ni pagos. Contratos, aceptaciones, liquidaciones, reclamos e incidentes podrán conservarse hasta cinco años o el plazo legal aplicable.

39. Domicilio para notificaciones, ley aplicable y competencia

Para los efectos de comunicaciones y notificaciones judiciales, administrativas o de naturaleza análoga, Rapa Go designa domicilio en Miru s/n, Isla de Pascua, Chile. El contrato se rige por las leyes chilenas y la competencia será la determinada legalmente, sin limitar derechos o acciones irrenunciables.

40. Integridad

El contrato y sus anexos contienen el acuerdo aplicable al Conductor persona natural. La nulidad de una cláusula no afecta las restantes. Las empresas operadoras deberán celebrar un contrato comercial separado.

ANEXO N.º 1 · INDIVIDUALIZACIÓN DEL CONDUCTOR

Nombre completo |

RUT |

Fecha de nacimiento |

Domicilio en Rapa Nui |

Correo |

Teléfono |

Banco / cuenta |

Domicilio tributario acreditado | Sí / No

Calidad territorial |

Documento de respaldo |

Vehículo asociado

Patente |

Marca / modelo |

Año |

Color |

Titular |

Permiso de circulación vence |

Categorías |

ANEXO N.º 2 · CONDICIONES ECONÓMICAS

Materia | Condición

Comisión | 23% de la tarifa total, IVA incluido.

Participación ordinaria | 77% antes del tratamiento tributario.

Express/Prioritario | La Comisión se aplica a la tarifa total incluido el recargo.

Cancelación ordinaria | Sin cargo antes de 1 minuto desde la asignación confirmada. Luego: 30% del viaje, tope $3.000. Si el Conductor llegó y el cargo se cobra: 50% Conductor / 50% Rapa Go.

No Show | 50% del viaje, tope $5.000, tras llegada y 5 minutos. 50% Conductor / 50% Rapa Go.

Liquidación | Semanal, lunes a domingo; transferencia lunes siguiente.

Objeción | 5 días hábiles.

Boleta | Mensual, primer día hábil; 3 días adicionales.

Saldo adeudado | Compensación o transferencia en 3 días hábiles.

ANEXO N.º 3 · FRANJA DE DESCONEXIÓN

Hora de inicio |

Hora de término |

Fecha desde la que rige |

Observaciones |

La modificación deberá solicitarse a conductores@rapago.cl con al menos veinticuatro horas de anticipación.

ANEXO N.º 4 · DOCUMENTOS, DECLARACIONES Y CONSENTIMIENTO SENSIBLE

[ ] Cédula vigente.

[ ] Licencia de conducir vigente.

[ ] Permiso de circulación vigente.

[ ] Certificado de antecedentes de hasta 30 días.

[ ] Verificación de inhabilidades.

[ ] Fotografía.

[ ] Datos bancarios.

[ ] Residencia y domicilio tributario en Rapa Nui.

[ ] Declaración de pertenencia rapanui o habilitación territorial, cuando corresponda.

[ ] Certificado de nacimiento del hijo o hija rapanui cuando corresponda.

[ ] Autorización de uso si el vehículo es de tercero.

El Conductor consiente expresamente el tratamiento de datos sensibles relativos a pertenencia al Pueblo Rapa Nui y de antecedentes familiares que voluntariamente proporcione para acreditar la habilitación aplicable, exclusivamente para fines de evaluación, habilitación, cumplimiento, auditoría y defensa jurídica, conforme a la Política de Privacidad.

ANEXO N.º 5 · CANAL DE RECLAMOS

Correo | conductores@rapago.cl

Teléfono local | +56 9 4796 4171

Lugar físico | Miru s/n, Isla de Pascua

Representante titular | Encargado de Gestión de Reclamos de Conductores; nombre informado en ficha vigente antes de habilitación.

Representante suplente | Integrante suplente del equipo; nombre informado en ficha vigente.

Primera instancia | Soporte / Administrador de la App

Apelación | Gerencia Legal

ANEXO N.º 6 · REGISTRO DE ACEPTACIÓN

Versión | 2.1

Identificador del Conductor |

Fecha y hora |

Usuario/cuenta |

Correo de envío PDF |

Contrato disponible en App | Sí / No

Capacitación aprobada | Sí / No

Validación documental | Sí / No

Consentimiento datos sensibles | Sí / No / No aplica

Anexo de seguro emitido | Sí / No

Representante de reclamos designado | Sí / No

Habilitación efectiva | Sí / No

DECLARACIÓN DE ACEPTACIÓN Al seleccionar “Acepto el Contrato de Prestación de Servicios”, el Conductor declara haber leído y comprendido el contrato y anexos, confirma la veracidad de sus antecedentes, presta los consentimientos específicos que correspondan y reconoce que la habilitación depende de las condiciones previas.
$rapago_driver_v21$,
      '2026-08-13',
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO target_id;
  ELSE
    UPDATE legal_documents
    SET title = 'Contrato de Prestación de Servicios de Conductor Independiente',
        effective_date = '2026-08-13',
        is_active = true,
        updated_at = NOW()
    WHERE id = target_id;
  END IF;

  UPDATE legal_documents
  SET is_active = (id = target_id),
      updated_at = CASE
        WHEN id = target_id OR is_active = true THEN NOW()
        ELSE updated_at
      END
  WHERE type = 'driver_conditions';
END
$publish_rapago_driver_v21$;

DO $verify_final_legal$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*)
  INTO bad_count
  FROM (
    VALUES
      ('terms_and_conditions', '4.0'),
      ('user_conditions', '1.1'),
      ('privacy_policy', '1.0'),
      ('driver_conditions', '2.1')
  ) AS expected(type, version)
  WHERE (
    SELECT COUNT(*)
    FROM legal_documents d
    WHERE d.type = expected.type
      AND d.version = expected.version
      AND d.is_active = true
  ) <> 1;

  IF bad_count <> 0 THEN
    RAISE EXCEPTION 'La publicacion legal definitiva no dejo una version activa exacta por tipo.';
  END IF;
END
$verify_final_legal$;

COMMIT;

-- Verificacion manual recomendada:
-- SELECT type, version, title, effective_date, is_active, id
-- FROM legal_documents
-- WHERE type IN ('terms_and_conditions','user_conditions','privacy_policy','driver_conditions')
-- ORDER BY type, is_active DESC, created_at DESC;
