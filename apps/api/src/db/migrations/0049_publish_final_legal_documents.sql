-- RAPA GO: publica las versiones legales definitivas del 29-07-2026.
-- Idempotente: actualiza la misma versión si ya existe y mantiene una sola activa por tipo.
BEGIN;

UPDATE legal_documents
SET is_active = false, updated_at = NOW()
WHERE type = 'terms_and_conditions' AND is_active = true;

INSERT INTO legal_documents (
  type, version, title, content, effective_date, is_active, created_at, updated_at
)
SELECT
  'terms_and_conditions',
  '3.0',
  'Términos y Condiciones Generales de Uso',
  $rapago_terms_v3$RAPA GO

TÉRMINOS Y CONDICIONES GENERALES DE USO

Aplicación móvil de intermediación de servicios de movilidad en Rapa Nui

1. Identificación del operador y ámbito de aplicación

La aplicación móvil Rapa Go y los servicios asociados a dicha marca son operados y administrados por Haka Taiko SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, comuna y territorio especial de Isla de Pascua, Región de Valparaíso, Chile, en adelante “Rapa Go”, el “Operador” o la “Plataforma”.

Estos Términos regulan el registro, acceso, solicitud, reserva, pago y uso de servicios de movilidad en Rapa Nui por usuarios y pasajeros. No regulan la relación entre Rapa Go y los conductores, quienes deberán aceptar un contrato específico antes de ser habilitados.

2. Jerarquía contractual y documentos complementarios

Forman parte del marco contractual aplicable al usuario: estos Términos Generales; las Condiciones de Usuarios; la Política de Privacidad; los consentimientos de geolocalización; las reglas de tarifas, cancelación y reembolso mostradas en la App; y las condiciones particulares de una reserva o promoción.

Las Condiciones de Usuarios son un anexo operativo subordinado. En caso de contradicción, prevalecerán estos Términos Generales y, a continuación, la condición particular informada y aceptada para el servicio específico, siempre que respete la legislación aplicable.

3. Definiciones

• App o Aplicación: el software móvil Rapa Go, sus interfaces y servicios asociados.

• Usuario: persona natural que crea una cuenta, solicita, reserva, paga o administra un servicio.

• Pasajero: persona que utiliza materialmente el servicio, sea o no quien lo solicitó.

• Conductor: prestador independiente habilitado que acepta y ejecuta el servicio.

• Servicio: traslado solicitado, reservado, asignado y registrado mediante la App.

• Tarifa: precio total mostrado al usuario antes de confirmar, incluidos cargos aplicables.

• Beneficio o saldo: monto registrado a favor del usuario por pago en exceso, ajuste, devolución o promoción; no constituye una cuenta bancaria ni billetera digital.

• Proveedor de pagos: Mercado Pago, Itaú Klap u otro proveedor autorizado utilizado para procesar pagos.

4. Aceptación, capacidad y vigencia

El usuario deberá ser mayor de dieciocho años y contar con capacidad legal suficiente. La aceptación se realizará mediante una acción afirmativa y quedará registrada con usuario, documento, versión, fecha y hora.

Las casillas obligatorias no estarán preseleccionadas. Los consentimientos opcionales, como comunicaciones comerciales, se solicitarán separadamente. La negativa a comunicaciones comerciales no impedirá recibir avisos operativos, de seguridad, pagos o cambios contractuales.

La versión vigente regirá desde su aceptación. Las modificaciones materiales requerirán nueva aceptación antes de continuar utilizando funciones reguladas.

5. Registro, autenticación y seguridad de la cuenta

El registro es obligatorio. El usuario deberá proporcionar los datos necesarios para identidad, contacto, categoría, seguridad, pagos y cumplimiento, incluyendo nombre, RUT o pasaporte, correo electrónico, teléfono y demás antecedentes mostrados como obligatorios. La fotografía será opcional para pasajeros.

La cuenta podrá crearse o autenticarse mediante correo electrónico y contraseña, Facebook y, en iOS, Sign in with Apple, cuando dichos mecanismos estén habilitados. Google Login no forma parte de la primera versión. Las identidades se vincularán a una única cuenta y no se fusionarán automáticamente solo por coincidencia de correo.

La contraseña local será voluntaria para quien se registre mediante un proveedor social, pero podrá configurarse mediante verificación de correo. El usuario deberá proteger sus credenciales y reportar accesos no autorizados.

6. Categorías de usuario y residencia acreditada

La App podrá distinguir entre la categoría “RAPA NUI / RESIDENTE RAPA NUI” y las categorías de visitante. Para efectos tarifarios, la categoría de residente corresponde exclusivamente a residencia territorial habilitada y acreditada; no constituye una declaración ni certificación de pertenencia étnica.

Los visitantes chilenos y extranjeros estarán sujetos a la misma tarifa base de visitante/no residente, salvo promociones, moneda, impuestos o servicios adicionales que se funden en criterios objetivos distintos de la nacionalidad.

El usuario deberá presentar el antecedente de residencia solicitado y acepta revisión administrativa. La información falsa podrá dar lugar a recategorización, cobro de diferencias, advertencia, suspensión o bloqueo en casos graves o reiterados.

7. Naturaleza y objeto de Rapa Go

Rapa Go proporciona infraestructura tecnológica para coordinar el contacto entre usuarios y conductores independientes; informa tarifas, administra reglas, registra viajes, procesa o coordina pagos y brinda soporte.

El conductor decide libremente si acepta una oferta. La publicación de una solicitud no garantiza aceptación ni un tiempo exacto de llegada. Lo anterior no limita las responsabilidades legales propias del Operador por sus actos, sistemas, información, cobros u obligaciones frente a consumidores.

8. Solicitud, reserva y asignación

El usuario deberá indicar origen, destino, categoría y medio de pago antes de confirmar. La App asignará la solicitud a un conductor por vez mediante criterios objetivos como proximidad, disponibilidad, categoría y capacidad.

Los dos minutos de cancelación gratuita comienzan cuando el conductor acepta y la asignación es confirmada al usuario. La preasignación o búsqueda previa no inicia dicho plazo.

El usuario podrá solicitar un servicio para un tercero adulto, debiendo identificar correctamente al pasajero y aplicar su categoría tarifaria. La App no ofrece, en la versión inicial, traslados de menores sin un adulto acompañante.

9. Información del conductor y del vehículo

Antes del inicio, la App mostrará, según disponibilidad técnica, nombre y fotografía del conductor, calificación, marca, modelo, color, patente y ubicación aproximada.

El usuario deberá verificar coincidencia. Ante discrepancias deberá abstenerse de abordar, contactar soporte y, cuando exista riesgo inmediato, comunicarse con la autoridad o servicio de emergencia competente.

10. Categorías, equipaje y servicios no disponibles

Las categorías iniciales podrán incluir Estándar, XL, Maletas y Express o Prioritario. Express podrá mostrarse cuando la asignación ordinaria tarde más de lo esperado.

Confort, Encomiendas, Tours, Rent a Car, Eventos y otras funciones futuras no se entenderán ofrecidas mientras no estén expresamente habilitadas y sujetas a condiciones específicas.

Objetos voluminosos deberán solicitarse en categoría compatible. No se permite transportar pasajeros en pick-up o espacios no habilitados. En el lanzamiento no se aceptan mascotas ni viajes multidestino o paradas adicionales.

11. Tarifas dinámicas, precio y redondeo

Las tarifas pueden considerar distancia, categoría, demanda, disponibilidad, residencia acreditada, reserva, modalidad Express, promociones y condiciones operativas.

El precio total mostrado antes de confirmar ya incorporará cualquier redondeo, incluido el redondeo a múltiplos de $500 cuando corresponda, y será el precio contratado.

El precio será cerrado, salvo error manifiesto, modificación autorizada por el usuario, contingencia de seguridad, corte de camino, instrucción de autoridad, fuerza mayor u otra circunstancia objetivamente verificable. La App no permite agregar paradas o destinos después de confirmar.

12. Pagos y documentación tributaria

Los servicios podrán pagarse mediante Mercado Pago u otros medios electrónicos habilitados y, cuando se ofrezca, en efectivo. Rapa Go no conserva números completos de tarjeta ni códigos de seguridad.

Mercado Pago o Itaú Klap emite un comprobante del procesamiento, que no reemplaza el documento tributario de Haka Taiko SpA. El Operador emitirá la boleta o factura que corresponda y la enviará al correo registrado, de acuerdo con la situación tributaria aplicable.

Para solicitar factura, el usuario deberá entregar razón social, RUT, giro, domicilio y correo válidos. El usuario es responsable de mantener actualizado su correo.

13. Beneficios, saldos y reembolsos

Los beneficios o saldos podrán originarse por pagos en exceso, ajustes, devoluciones o promociones. No pueden cargarse voluntariamente, transferirse entre usuarios ni retirarse directamente desde la App.

Un saldo reembolsable podrá utilizarse en servicios posteriores o devolverse a una cuenta bancaria solicitándolo por Centro de Ayuda o pagos@rapago.cl. La respuesta inicial se procurará dentro de tres días hábiles y la transferencia dentro de cinco días hábiles desde la validación bancaria.

Los datos bancarios se recibirán preferentemente mediante canal autenticado, se cifrarán, tendrán acceso restringido y se eliminarán conforme a la Política de Privacidad. Los créditos promocionales podrán estar sujetos a condiciones propias y no necesariamente serán canjeables por dinero.

14. Cancelación ordinaria

El usuario podrá cancelar sin cargo durante los primeros dos minutos contados desde la aceptación confirmada del conductor.

Desde el tercer minuto se cobrará el treinta por ciento del valor total del viaje, con tope máximo de $3.000. No procederá el cargo cuando la cancelación se deba a discrepancia de conductor o vehículo, riesgo de seguridad, error de la Plataforma, duplicidad, demora extraordinaria imputable al conductor u otra causa justificada aceptada por Rapa Go.

En reservas programadas, la cancelación será gratuita hasta treinta minutos antes. Dentro de los treinta minutos previos se aplicará la misma regla del treinta por ciento, con tope de $3.000.

15. No presentación del pasajero

Si el conductor registra su llegada al punto de retiro y el pasajero no se presenta dentro de cinco minutos, podrá aplicarse un cargo equivalente al cincuenta por ciento del valor total del viaje, con tope de $5.000.

El cargo requiere llegada verificable y tiempo de espera registrado. No procederá cuando exista error relevante de ubicación, imposibilidad de contacto imputable a la Plataforma, discrepancia del vehículo o conductor, riesgo de seguridad u otra causa justificada.

La distribución interna del cargo entre Rapa Go y el conductor no modifica el monto mostrado al usuario.

16. Obligaciones del usuario

• Proporcionar información verdadera, mantener datos y medio de contacto actualizados.

• Estar disponible en el punto de retiro y verificar conductor y vehículo.

• Usar cinturón de seguridad y cumplir instrucciones razonables de seguridad.

• No exceder capacidad, solicitar una categoría compatible con equipaje y proveer sistemas de retención infantil cuando legalmente corresponda.

• Pagar la tarifa y cargos válidamente informados.

• Tratar respetuosamente a conductores, personal y comunidad.

• No solicitar detenciones, rutas o conductas contrarias a la ley o seguridad.

17. Conductas prohibidas

• Fraude, suplantación, cuentas múltiples abusivas, contracargos infundados o manipulación de promociones.

• Agresión, amenaza, acoso, discriminación, daños o lenguaje ofensivo.

• Portar objetos ilícitos, peligrosos o incompatibles con el transporte seguro.

• Solicitar servicios fuera de la App para eludir tarifas, trazabilidad o seguridad.

• Interferir con la App, geolocalización, pagos o sistemas de seguridad.

• Usar datos personales del conductor para fines distintos del viaje.

18. Seguridad, rechazo o término anticipado

El conductor podrá rechazar o terminar un servicio si existe riesgo, agresión, exceso de pasajeros, conducta ilícita, equipaje peligroso, condiciones inseguras, camino bloqueado o fuerza mayor.

Cuando sea posible, el conductor deberá detenerse en un lugar seguro. Rapa Go podrá investigar y adoptar medidas proporcionales.

19. Accidentes, incidentes y emergencias

Ante riesgo inmediato, el usuario deberá contactar directamente a los servicios públicos de emergencia. Los canales de Rapa Go permiten reportar y preservar antecedentes, pero no reemplazan a Carabineros, servicios de salud, Bomberos ni autoridades competentes.

Rapa Go podrá solicitar ubicación, fotografías, relato, identificación de viaje y documentos. Podrá suspender preventivamente cuentas o vehículos mientras se verifica un incidente grave y deberá colaborar con requerimientos formales de autoridad.

20. Responsabilidad y derechos del consumidor

El conductor responde por la conducción y ejecución material del servicio. Rapa Go responde por sus propios actos u omisiones, administración de la Plataforma, información, sistemas y obligaciones legales.

Rapa Go no garantiza disponibilidad permanente, tiempo exacto de llegada ni funcionamiento ininterrumpido en condiciones de baja conectividad, GPS deficiente, clima, caminos, fallas de terceros o fuerza mayor.

Ninguna cláusula excluye derechos irrenunciables del consumidor, responsabilidad por dolo o culpa grave ni responsabilidades que la ley no permita limitar.

21. Objetos olvidados

El usuario deberá reportar el objeto mediante Centro de Ayuda, WhatsApp o reclamos@rapago.cl, indicando viaje, descripción y contacto. Rapa Go realizará gestiones razonables sin garantizar recuperación.

Si el conductor debe efectuar un desplazamiento adicional, podrá aplicarse un cargo de gestión previamente informado. Los objetos no reclamados podrán entregarse a la autoridad o gestionarse conforme a ley.

22. Calificaciones y comentarios

El usuario podrá calificar al conductor. Los comentarios escritos serán privados y accesibles solo para Admin, Soporte y Jurídica cuando exista necesidad funcional. El conductor verá promedio, puntuación y cantidad, no el texto privado.

Rapa Go podrá moderar contenido ofensivo, ilícito o con datos personales. Los comentarios ordinarios se conservarán por el plazo informado en la Política de Privacidad y podrán mantenerse hasta cinco años cuando se vinculen a reclamos, fraude o incidentes.

23. Soporte, reclamos e investigaciones

Los canales oficiales son el Centro de Ayuda dentro de la App, soporte@rapago.cl, reclamos@rapago.cl, privacidad@rapago.cl y WhatsApp institucional +56 9 4796 4171.

La atención humana se prestará todos los días de 08:00 a 22:00 horas de Rapa Nui. Fuera de horario existirá recepción automática y un turno para alertas críticas. No se ofrece atención humana general 24/7.

Rapa Go procurará responder casos simples dentro de tres días hábiles y complejos dentro de cinco. Las investigaciones podrán extenderse hasta diez días hábiles, prorrogables fundadamente.

24. Suspensión, bloqueo y cierre de cuentas

Rapa Go podrá advertir, suspender preventivamente, bloquear o cerrar cuentas por fraude, suplantación, impago, abuso de reembolsos, agresión, acoso, riesgo de seguridad, daño, incumplimiento cultural grave o infracción contractual.

Cuando la naturaleza lo permita, el usuario será informado y podrá presentar antecedentes. Las medidas preventivas deberán revisarse y ser proporcionales.

25. Respeto al Pueblo Rapa Nui, cultura y patrimonio

La operación se desarrolla en un territorio de alto valor cultural, espiritual, histórico, arqueológico, comunitario y ambiental. Todos los usuarios deberán respetar al Pueblo Rapa Nui, su idioma, tradiciones, comunidades, sitios sagrados, patrimonio, propietarios y reglas de convivencia.

• Está prohibido ingresar o promover el ingreso a zonas arqueológicas, sagradas, privadas o restringidas sin autorización.

• Está prohibido tocar, remover, dañar, intervenir, profanar o alterar patrimonio cultural o natural.

• No se permiten burlas, discriminación ni conductas ofensivas.

• El servicio de movilidad no incluye entradas, permisos, accesos ni guiado turístico profesional.

• Un incumplimiento grave podrá originar bloqueo y comunicación a la autoridad.

26. Privacidad y tratamiento de datos

El tratamiento se regirá por la Política de Privacidad publicada en api.rapago.cl/privacidad. Haka Taiko SpA es responsable del tratamiento bajo la marca Rapa Go.

La infraestructura de producción comprende frontend y páginas legales en api.rapago.cl; API Fastify en backend.rapago.cl sobre Hostinger; y PostgreSQL/Supabase en São Paulo, Brasil, además de proveedores de autenticación, mapas, ubicación, pagos, correo y soporte descritos en la Política.

Rapa Go aplicará medidas de seguridad, acceso por roles, cifrado, auditoría, respaldos y plazos de conservación. La Política será adecuada a la legislación vigente y a la entrada en vigor de la Ley N.º 21.719.

27. Geolocalización

El pasajero compartirá ubicación cuando confirme el origen o envíe la solicitud. Puede ingresar manualmente origen y destino si rechaza GPS.

La ubicación del conductor antes del viaje se utilizará transitoriamente para disponibilidad y asignación; se conservará solo la última coordenada operativa por hasta quince minutos y no se generará una ruta previa.

Durante un servicio activo, el conductor podrá transmitir ubicación en segundo plano cuando sea indispensable. El seguimiento finalizará al completar, cancelar, cerrar sesión o perder autorización, sin perjuicio de registros ya generados.

28. Eliminación de cuenta

El usuario podrá iniciar la eliminación desde la App y desde api.rapago.cl/eliminar-cuenta. El proceso exige verificación razonable de identidad y se completará dentro de treinta días desde la verificación, salvo aplazamiento objetivo.

La eliminación podrá aplazarse por viaje o reserva activa, saldo o devolución pendiente, reclamo, contracargo, investigación de fraude u obligación legal. La cuenta no se mantendrá activa por el solo hecho de conservar registros mínimos.

Rapa Go podrá solicitar opcionalmente el motivo de eliminación; la negativa a informarlo no impedirá el ejercicio. Solo podrá no procesarse una solicitud cuando no sea posible verificar identidad, corresponda a una cuenta inexistente o duplicada, o ya haya sido ejecutada.

Cuando la cuenta use Sign in with Apple, Rapa Go revocará los tokens asociados conforme al procedimiento oficial, una vez finalizada la integración y prueba productiva.

29. Propiedad intelectual, licencia y tiendas

Rapa Go, la App, interfaces, software, bases de datos, diseños, textos, gráficos y signos pertenecen al Operador o sus licenciantes. El usuario recibe una licencia personal, limitada, revocable, no exclusiva e intransferible para uso legítimo.

En dispositivos Apple, la licencia se complementa con la EULA estándar de Apple. Apple y Google no prestan el servicio de movilidad ni son parte del contrato entre usuario y Rapa Go.

30. Proveedores y servicios de terceros

La App integra, según sistema operativo y versión, Facebook Login, Sign in with Apple, Google Maps o MapKit, servicios de ubicación, Mercado Pago, Hostinger, Supabase, correo Gmail/SMTP y WhatsApp. Google Login, Firebase, Sentry, Google Analytics y Crashlytics no se encuentran activos en la primera versión.

Cada proveedor puede tener términos propios. Rapa Go procurará limitar los datos al mínimo necesario y reflejar el tratamiento en la Política de Privacidad y declaraciones de las tiendas.

31. Disponibilidad, actualizaciones y continuidad

Rapa Go podrá corregir, mejorar, suspender temporalmente o retirar funciones por mantenimiento, seguridad, cumplimiento o necesidades operativas. Las modificaciones materiales se informarán y requerirán aceptación cuando corresponda.

Los servicios coordinados completamente fuera de la App no disponen de su trazabilidad, soporte ni mecanismos de reclamo.

32. Módulos futuros

Rapa Go podrá incorporar Tours, Rent a Car, Eventos, Encomiendas, Publicidad u otros módulos. Cada uno tendrá condiciones específicas. Mientras no aparezca habilitado, no se entenderá ofrecido ni contratado.

33. Modificaciones de los Términos

Rapa Go podrá modificar estos Términos por cambios legales, regulatorios, tecnológicos, operativos o comerciales. Las modificaciones relevantes se informarán y requerirán aceptación expresa. Se conservará historial de versiones.

34. Ley aplicable, domicilio y competencia

Estos Términos se rigen por las leyes de Chile. El Operador fija domicilio en Isla de Pascua para comunicaciones, sin perjuicio de los derechos irrenunciables del consumidor y de las reglas legales de competencia.

El usuario podrá recurrir a los canales de Rapa Go, al Servicio Nacional del Consumidor y a los tribunales o autoridades determinados por la ley.

35. Idioma, vigencia y contacto

Los Términos podrán ofrecerse en español e inglés. En caso de discrepancia interpretativa prevalecerá el español, sin afectar derechos legales.

La versión 3.0 entra en vigor desde su publicación y aceptación electrónica.

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 3.0

Fecha | 29 de julio de 2026

NATURALEZA DEL DOCUMENTO / Documento contractual aplicable a usuarios y pasajeros. Las condiciones de conductores se regulan en un contrato separado.

NOTA DE IMPLEMENTACIÓN / La versión definitiva deberá publicarse en la URL canónica api.rapago.cl/terminos y coincidir exactamente con la versión aceptada dentro de la App.

INFORMACIÓN ESENCIAL / Rapa Go es una marca operada por Haka Taiko SpA. La App permite solicitar y coordinar servicios de movilidad prestados por conductores independientes habilitados. La creación de una cuenta y la contratación de un servicio requieren aceptación expresa de estos Términos, de las Condiciones de Usuarios como anexo subordinado y conocimiento de la Política de Privacidad.

Materia | Canal oficial

Soporte general | Centro de Ayuda · soporte@rapago.cl · WhatsApp +56 9 4796 4171

Reclamos | reclamos@rapago.cl

Privacidad y eliminación | privacidad@rapago.cl · api.rapago.cl/eliminar-cuenta

Pagos y reembolsos | pagos@rapago.cl

Facturación | contabilidad@rapago.cl

Comunicaciones legales | legal@rapago.cl

Domicilio | Miru s/n, Isla de Pascua, Chile

ACEPTACIÓN / Al seleccionar “Acepto”, el usuario declara haber leído y comprendido estos Términos y acepta quedar obligado por ellos, por las Condiciones de Usuarios y por las reglas específicas mostradas antes de contratar.$rapago_terms_v3$,
  '2026-07-29',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM legal_documents
  WHERE type = 'terms_and_conditions' AND version = '3.0'
);

UPDATE legal_documents
SET
  title = 'Términos y Condiciones Generales de Uso',
  content = $rapago_terms_v3$RAPA GO

TÉRMINOS Y CONDICIONES GENERALES DE USO

Aplicación móvil de intermediación de servicios de movilidad en Rapa Nui

1. Identificación del operador y ámbito de aplicación

La aplicación móvil Rapa Go y los servicios asociados a dicha marca son operados y administrados por Haka Taiko SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, comuna y territorio especial de Isla de Pascua, Región de Valparaíso, Chile, en adelante “Rapa Go”, el “Operador” o la “Plataforma”.

Estos Términos regulan el registro, acceso, solicitud, reserva, pago y uso de servicios de movilidad en Rapa Nui por usuarios y pasajeros. No regulan la relación entre Rapa Go y los conductores, quienes deberán aceptar un contrato específico antes de ser habilitados.

2. Jerarquía contractual y documentos complementarios

Forman parte del marco contractual aplicable al usuario: estos Términos Generales; las Condiciones de Usuarios; la Política de Privacidad; los consentimientos de geolocalización; las reglas de tarifas, cancelación y reembolso mostradas en la App; y las condiciones particulares de una reserva o promoción.

Las Condiciones de Usuarios son un anexo operativo subordinado. En caso de contradicción, prevalecerán estos Términos Generales y, a continuación, la condición particular informada y aceptada para el servicio específico, siempre que respete la legislación aplicable.

3. Definiciones

• App o Aplicación: el software móvil Rapa Go, sus interfaces y servicios asociados.

• Usuario: persona natural que crea una cuenta, solicita, reserva, paga o administra un servicio.

• Pasajero: persona que utiliza materialmente el servicio, sea o no quien lo solicitó.

• Conductor: prestador independiente habilitado que acepta y ejecuta el servicio.

• Servicio: traslado solicitado, reservado, asignado y registrado mediante la App.

• Tarifa: precio total mostrado al usuario antes de confirmar, incluidos cargos aplicables.

• Beneficio o saldo: monto registrado a favor del usuario por pago en exceso, ajuste, devolución o promoción; no constituye una cuenta bancaria ni billetera digital.

• Proveedor de pagos: Mercado Pago, Itaú Klap u otro proveedor autorizado utilizado para procesar pagos.

4. Aceptación, capacidad y vigencia

El usuario deberá ser mayor de dieciocho años y contar con capacidad legal suficiente. La aceptación se realizará mediante una acción afirmativa y quedará registrada con usuario, documento, versión, fecha y hora.

Las casillas obligatorias no estarán preseleccionadas. Los consentimientos opcionales, como comunicaciones comerciales, se solicitarán separadamente. La negativa a comunicaciones comerciales no impedirá recibir avisos operativos, de seguridad, pagos o cambios contractuales.

La versión vigente regirá desde su aceptación. Las modificaciones materiales requerirán nueva aceptación antes de continuar utilizando funciones reguladas.

5. Registro, autenticación y seguridad de la cuenta

El registro es obligatorio. El usuario deberá proporcionar los datos necesarios para identidad, contacto, categoría, seguridad, pagos y cumplimiento, incluyendo nombre, RUT o pasaporte, correo electrónico, teléfono y demás antecedentes mostrados como obligatorios. La fotografía será opcional para pasajeros.

La cuenta podrá crearse o autenticarse mediante correo electrónico y contraseña, Facebook y, en iOS, Sign in with Apple, cuando dichos mecanismos estén habilitados. Google Login no forma parte de la primera versión. Las identidades se vincularán a una única cuenta y no se fusionarán automáticamente solo por coincidencia de correo.

La contraseña local será voluntaria para quien se registre mediante un proveedor social, pero podrá configurarse mediante verificación de correo. El usuario deberá proteger sus credenciales y reportar accesos no autorizados.

6. Categorías de usuario y residencia acreditada

La App podrá distinguir entre la categoría “RAPA NUI / RESIDENTE RAPA NUI” y las categorías de visitante. Para efectos tarifarios, la categoría de residente corresponde exclusivamente a residencia territorial habilitada y acreditada; no constituye una declaración ni certificación de pertenencia étnica.

Los visitantes chilenos y extranjeros estarán sujetos a la misma tarifa base de visitante/no residente, salvo promociones, moneda, impuestos o servicios adicionales que se funden en criterios objetivos distintos de la nacionalidad.

El usuario deberá presentar el antecedente de residencia solicitado y acepta revisión administrativa. La información falsa podrá dar lugar a recategorización, cobro de diferencias, advertencia, suspensión o bloqueo en casos graves o reiterados.

7. Naturaleza y objeto de Rapa Go

Rapa Go proporciona infraestructura tecnológica para coordinar el contacto entre usuarios y conductores independientes; informa tarifas, administra reglas, registra viajes, procesa o coordina pagos y brinda soporte.

El conductor decide libremente si acepta una oferta. La publicación de una solicitud no garantiza aceptación ni un tiempo exacto de llegada. Lo anterior no limita las responsabilidades legales propias del Operador por sus actos, sistemas, información, cobros u obligaciones frente a consumidores.

8. Solicitud, reserva y asignación

El usuario deberá indicar origen, destino, categoría y medio de pago antes de confirmar. La App asignará la solicitud a un conductor por vez mediante criterios objetivos como proximidad, disponibilidad, categoría y capacidad.

Los dos minutos de cancelación gratuita comienzan cuando el conductor acepta y la asignación es confirmada al usuario. La preasignación o búsqueda previa no inicia dicho plazo.

El usuario podrá solicitar un servicio para un tercero adulto, debiendo identificar correctamente al pasajero y aplicar su categoría tarifaria. La App no ofrece, en la versión inicial, traslados de menores sin un adulto acompañante.

9. Información del conductor y del vehículo

Antes del inicio, la App mostrará, según disponibilidad técnica, nombre y fotografía del conductor, calificación, marca, modelo, color, patente y ubicación aproximada.

El usuario deberá verificar coincidencia. Ante discrepancias deberá abstenerse de abordar, contactar soporte y, cuando exista riesgo inmediato, comunicarse con la autoridad o servicio de emergencia competente.

10. Categorías, equipaje y servicios no disponibles

Las categorías iniciales podrán incluir Estándar, XL, Maletas y Express o Prioritario. Express podrá mostrarse cuando la asignación ordinaria tarde más de lo esperado.

Confort, Encomiendas, Tours, Rent a Car, Eventos y otras funciones futuras no se entenderán ofrecidas mientras no estén expresamente habilitadas y sujetas a condiciones específicas.

Objetos voluminosos deberán solicitarse en categoría compatible. No se permite transportar pasajeros en pick-up o espacios no habilitados. En el lanzamiento no se aceptan mascotas ni viajes multidestino o paradas adicionales.

11. Tarifas dinámicas, precio y redondeo

Las tarifas pueden considerar distancia, categoría, demanda, disponibilidad, residencia acreditada, reserva, modalidad Express, promociones y condiciones operativas.

El precio total mostrado antes de confirmar ya incorporará cualquier redondeo, incluido el redondeo a múltiplos de $500 cuando corresponda, y será el precio contratado.

El precio será cerrado, salvo error manifiesto, modificación autorizada por el usuario, contingencia de seguridad, corte de camino, instrucción de autoridad, fuerza mayor u otra circunstancia objetivamente verificable. La App no permite agregar paradas o destinos después de confirmar.

12. Pagos y documentación tributaria

Los servicios podrán pagarse mediante Mercado Pago u otros medios electrónicos habilitados y, cuando se ofrezca, en efectivo. Rapa Go no conserva números completos de tarjeta ni códigos de seguridad.

Mercado Pago o Itaú Klap emite un comprobante del procesamiento, que no reemplaza el documento tributario de Haka Taiko SpA. El Operador emitirá la boleta o factura que corresponda y la enviará al correo registrado, de acuerdo con la situación tributaria aplicable.

Para solicitar factura, el usuario deberá entregar razón social, RUT, giro, domicilio y correo válidos. El usuario es responsable de mantener actualizado su correo.

13. Beneficios, saldos y reembolsos

Los beneficios o saldos podrán originarse por pagos en exceso, ajustes, devoluciones o promociones. No pueden cargarse voluntariamente, transferirse entre usuarios ni retirarse directamente desde la App.

Un saldo reembolsable podrá utilizarse en servicios posteriores o devolverse a una cuenta bancaria solicitándolo por Centro de Ayuda o pagos@rapago.cl. La respuesta inicial se procurará dentro de tres días hábiles y la transferencia dentro de cinco días hábiles desde la validación bancaria.

Los datos bancarios se recibirán preferentemente mediante canal autenticado, se cifrarán, tendrán acceso restringido y se eliminarán conforme a la Política de Privacidad. Los créditos promocionales podrán estar sujetos a condiciones propias y no necesariamente serán canjeables por dinero.

14. Cancelación ordinaria

El usuario podrá cancelar sin cargo durante los primeros dos minutos contados desde la aceptación confirmada del conductor.

Desde el tercer minuto se cobrará el treinta por ciento del valor total del viaje, con tope máximo de $3.000. No procederá el cargo cuando la cancelación se deba a discrepancia de conductor o vehículo, riesgo de seguridad, error de la Plataforma, duplicidad, demora extraordinaria imputable al conductor u otra causa justificada aceptada por Rapa Go.

En reservas programadas, la cancelación será gratuita hasta treinta minutos antes. Dentro de los treinta minutos previos se aplicará la misma regla del treinta por ciento, con tope de $3.000.

15. No presentación del pasajero

Si el conductor registra su llegada al punto de retiro y el pasajero no se presenta dentro de cinco minutos, podrá aplicarse un cargo equivalente al cincuenta por ciento del valor total del viaje, con tope de $5.000.

El cargo requiere llegada verificable y tiempo de espera registrado. No procederá cuando exista error relevante de ubicación, imposibilidad de contacto imputable a la Plataforma, discrepancia del vehículo o conductor, riesgo de seguridad u otra causa justificada.

La distribución interna del cargo entre Rapa Go y el conductor no modifica el monto mostrado al usuario.

16. Obligaciones del usuario

• Proporcionar información verdadera, mantener datos y medio de contacto actualizados.

• Estar disponible en el punto de retiro y verificar conductor y vehículo.

• Usar cinturón de seguridad y cumplir instrucciones razonables de seguridad.

• No exceder capacidad, solicitar una categoría compatible con equipaje y proveer sistemas de retención infantil cuando legalmente corresponda.

• Pagar la tarifa y cargos válidamente informados.

• Tratar respetuosamente a conductores, personal y comunidad.

• No solicitar detenciones, rutas o conductas contrarias a la ley o seguridad.

17. Conductas prohibidas

• Fraude, suplantación, cuentas múltiples abusivas, contracargos infundados o manipulación de promociones.

• Agresión, amenaza, acoso, discriminación, daños o lenguaje ofensivo.

• Portar objetos ilícitos, peligrosos o incompatibles con el transporte seguro.

• Solicitar servicios fuera de la App para eludir tarifas, trazabilidad o seguridad.

• Interferir con la App, geolocalización, pagos o sistemas de seguridad.

• Usar datos personales del conductor para fines distintos del viaje.

18. Seguridad, rechazo o término anticipado

El conductor podrá rechazar o terminar un servicio si existe riesgo, agresión, exceso de pasajeros, conducta ilícita, equipaje peligroso, condiciones inseguras, camino bloqueado o fuerza mayor.

Cuando sea posible, el conductor deberá detenerse en un lugar seguro. Rapa Go podrá investigar y adoptar medidas proporcionales.

19. Accidentes, incidentes y emergencias

Ante riesgo inmediato, el usuario deberá contactar directamente a los servicios públicos de emergencia. Los canales de Rapa Go permiten reportar y preservar antecedentes, pero no reemplazan a Carabineros, servicios de salud, Bomberos ni autoridades competentes.

Rapa Go podrá solicitar ubicación, fotografías, relato, identificación de viaje y documentos. Podrá suspender preventivamente cuentas o vehículos mientras se verifica un incidente grave y deberá colaborar con requerimientos formales de autoridad.

20. Responsabilidad y derechos del consumidor

El conductor responde por la conducción y ejecución material del servicio. Rapa Go responde por sus propios actos u omisiones, administración de la Plataforma, información, sistemas y obligaciones legales.

Rapa Go no garantiza disponibilidad permanente, tiempo exacto de llegada ni funcionamiento ininterrumpido en condiciones de baja conectividad, GPS deficiente, clima, caminos, fallas de terceros o fuerza mayor.

Ninguna cláusula excluye derechos irrenunciables del consumidor, responsabilidad por dolo o culpa grave ni responsabilidades que la ley no permita limitar.

21. Objetos olvidados

El usuario deberá reportar el objeto mediante Centro de Ayuda, WhatsApp o reclamos@rapago.cl, indicando viaje, descripción y contacto. Rapa Go realizará gestiones razonables sin garantizar recuperación.

Si el conductor debe efectuar un desplazamiento adicional, podrá aplicarse un cargo de gestión previamente informado. Los objetos no reclamados podrán entregarse a la autoridad o gestionarse conforme a ley.

22. Calificaciones y comentarios

El usuario podrá calificar al conductor. Los comentarios escritos serán privados y accesibles solo para Admin, Soporte y Jurídica cuando exista necesidad funcional. El conductor verá promedio, puntuación y cantidad, no el texto privado.

Rapa Go podrá moderar contenido ofensivo, ilícito o con datos personales. Los comentarios ordinarios se conservarán por el plazo informado en la Política de Privacidad y podrán mantenerse hasta cinco años cuando se vinculen a reclamos, fraude o incidentes.

23. Soporte, reclamos e investigaciones

Los canales oficiales son el Centro de Ayuda dentro de la App, soporte@rapago.cl, reclamos@rapago.cl, privacidad@rapago.cl y WhatsApp institucional +56 9 4796 4171.

La atención humana se prestará todos los días de 08:00 a 22:00 horas de Rapa Nui. Fuera de horario existirá recepción automática y un turno para alertas críticas. No se ofrece atención humana general 24/7.

Rapa Go procurará responder casos simples dentro de tres días hábiles y complejos dentro de cinco. Las investigaciones podrán extenderse hasta diez días hábiles, prorrogables fundadamente.

24. Suspensión, bloqueo y cierre de cuentas

Rapa Go podrá advertir, suspender preventivamente, bloquear o cerrar cuentas por fraude, suplantación, impago, abuso de reembolsos, agresión, acoso, riesgo de seguridad, daño, incumplimiento cultural grave o infracción contractual.

Cuando la naturaleza lo permita, el usuario será informado y podrá presentar antecedentes. Las medidas preventivas deberán revisarse y ser proporcionales.

25. Respeto al Pueblo Rapa Nui, cultura y patrimonio

La operación se desarrolla en un territorio de alto valor cultural, espiritual, histórico, arqueológico, comunitario y ambiental. Todos los usuarios deberán respetar al Pueblo Rapa Nui, su idioma, tradiciones, comunidades, sitios sagrados, patrimonio, propietarios y reglas de convivencia.

• Está prohibido ingresar o promover el ingreso a zonas arqueológicas, sagradas, privadas o restringidas sin autorización.

• Está prohibido tocar, remover, dañar, intervenir, profanar o alterar patrimonio cultural o natural.

• No se permiten burlas, discriminación ni conductas ofensivas.

• El servicio de movilidad no incluye entradas, permisos, accesos ni guiado turístico profesional.

• Un incumplimiento grave podrá originar bloqueo y comunicación a la autoridad.

26. Privacidad y tratamiento de datos

El tratamiento se regirá por la Política de Privacidad publicada en api.rapago.cl/privacidad. Haka Taiko SpA es responsable del tratamiento bajo la marca Rapa Go.

La infraestructura de producción comprende frontend y páginas legales en api.rapago.cl; API Fastify en backend.rapago.cl sobre Hostinger; y PostgreSQL/Supabase en São Paulo, Brasil, además de proveedores de autenticación, mapas, ubicación, pagos, correo y soporte descritos en la Política.

Rapa Go aplicará medidas de seguridad, acceso por roles, cifrado, auditoría, respaldos y plazos de conservación. La Política será adecuada a la legislación vigente y a la entrada en vigor de la Ley N.º 21.719.

27. Geolocalización

El pasajero compartirá ubicación cuando confirme el origen o envíe la solicitud. Puede ingresar manualmente origen y destino si rechaza GPS.

La ubicación del conductor antes del viaje se utilizará transitoriamente para disponibilidad y asignación; se conservará solo la última coordenada operativa por hasta quince minutos y no se generará una ruta previa.

Durante un servicio activo, el conductor podrá transmitir ubicación en segundo plano cuando sea indispensable. El seguimiento finalizará al completar, cancelar, cerrar sesión o perder autorización, sin perjuicio de registros ya generados.

28. Eliminación de cuenta

El usuario podrá iniciar la eliminación desde la App y desde api.rapago.cl/eliminar-cuenta. El proceso exige verificación razonable de identidad y se completará dentro de treinta días desde la verificación, salvo aplazamiento objetivo.

La eliminación podrá aplazarse por viaje o reserva activa, saldo o devolución pendiente, reclamo, contracargo, investigación de fraude u obligación legal. La cuenta no se mantendrá activa por el solo hecho de conservar registros mínimos.

Rapa Go podrá solicitar opcionalmente el motivo de eliminación; la negativa a informarlo no impedirá el ejercicio. Solo podrá no procesarse una solicitud cuando no sea posible verificar identidad, corresponda a una cuenta inexistente o duplicada, o ya haya sido ejecutada.

Cuando la cuenta use Sign in with Apple, Rapa Go revocará los tokens asociados conforme al procedimiento oficial, una vez finalizada la integración y prueba productiva.

29. Propiedad intelectual, licencia y tiendas

Rapa Go, la App, interfaces, software, bases de datos, diseños, textos, gráficos y signos pertenecen al Operador o sus licenciantes. El usuario recibe una licencia personal, limitada, revocable, no exclusiva e intransferible para uso legítimo.

En dispositivos Apple, la licencia se complementa con la EULA estándar de Apple. Apple y Google no prestan el servicio de movilidad ni son parte del contrato entre usuario y Rapa Go.

30. Proveedores y servicios de terceros

La App integra, según sistema operativo y versión, Facebook Login, Sign in with Apple, Google Maps o MapKit, servicios de ubicación, Mercado Pago, Hostinger, Supabase, correo Gmail/SMTP y WhatsApp. Google Login, Firebase, Sentry, Google Analytics y Crashlytics no se encuentran activos en la primera versión.

Cada proveedor puede tener términos propios. Rapa Go procurará limitar los datos al mínimo necesario y reflejar el tratamiento en la Política de Privacidad y declaraciones de las tiendas.

31. Disponibilidad, actualizaciones y continuidad

Rapa Go podrá corregir, mejorar, suspender temporalmente o retirar funciones por mantenimiento, seguridad, cumplimiento o necesidades operativas. Las modificaciones materiales se informarán y requerirán aceptación cuando corresponda.

Los servicios coordinados completamente fuera de la App no disponen de su trazabilidad, soporte ni mecanismos de reclamo.

32. Módulos futuros

Rapa Go podrá incorporar Tours, Rent a Car, Eventos, Encomiendas, Publicidad u otros módulos. Cada uno tendrá condiciones específicas. Mientras no aparezca habilitado, no se entenderá ofrecido ni contratado.

33. Modificaciones de los Términos

Rapa Go podrá modificar estos Términos por cambios legales, regulatorios, tecnológicos, operativos o comerciales. Las modificaciones relevantes se informarán y requerirán aceptación expresa. Se conservará historial de versiones.

34. Ley aplicable, domicilio y competencia

Estos Términos se rigen por las leyes de Chile. El Operador fija domicilio en Isla de Pascua para comunicaciones, sin perjuicio de los derechos irrenunciables del consumidor y de las reglas legales de competencia.

El usuario podrá recurrir a los canales de Rapa Go, al Servicio Nacional del Consumidor y a los tribunales o autoridades determinados por la ley.

35. Idioma, vigencia y contacto

Los Términos podrán ofrecerse en español e inglés. En caso de discrepancia interpretativa prevalecerá el español, sin afectar derechos legales.

La versión 3.0 entra en vigor desde su publicación y aceptación electrónica.

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 3.0

Fecha | 29 de julio de 2026

NATURALEZA DEL DOCUMENTO / Documento contractual aplicable a usuarios y pasajeros. Las condiciones de conductores se regulan en un contrato separado.

NOTA DE IMPLEMENTACIÓN / La versión definitiva deberá publicarse en la URL canónica api.rapago.cl/terminos y coincidir exactamente con la versión aceptada dentro de la App.

INFORMACIÓN ESENCIAL / Rapa Go es una marca operada por Haka Taiko SpA. La App permite solicitar y coordinar servicios de movilidad prestados por conductores independientes habilitados. La creación de una cuenta y la contratación de un servicio requieren aceptación expresa de estos Términos, de las Condiciones de Usuarios como anexo subordinado y conocimiento de la Política de Privacidad.

Materia | Canal oficial

Soporte general | Centro de Ayuda · soporte@rapago.cl · WhatsApp +56 9 4796 4171

Reclamos | reclamos@rapago.cl

Privacidad y eliminación | privacidad@rapago.cl · api.rapago.cl/eliminar-cuenta

Pagos y reembolsos | pagos@rapago.cl

Facturación | contabilidad@rapago.cl

Comunicaciones legales | legal@rapago.cl

Domicilio | Miru s/n, Isla de Pascua, Chile

ACEPTACIÓN / Al seleccionar “Acepto”, el usuario declara haber leído y comprendido estos Términos y acepta quedar obligado por ellos, por las Condiciones de Usuarios y por las reglas específicas mostradas antes de contratar.$rapago_terms_v3$,
  effective_date = '2026-07-29',
  is_active = true,
  updated_at = NOW()
WHERE type = 'terms_and_conditions' AND version = '3.0';

UPDATE legal_documents
SET is_active = false, updated_at = NOW()
WHERE type = 'user_conditions' AND is_active = true;

INSERT INTO legal_documents (
  type, version, title, content, effective_date, is_active, created_at, updated_at
)
SELECT
  'user_conditions',
  '1.0',
  'Condiciones de Usuarios',
  $rapago_users_v1$RAPA GO

CONDICIONES DE USUARIOS

Anexo operativo subordinado a los Términos y Condiciones Generales

1. Objeto, subordinación y prevalencia

Estas Condiciones establecen reglas operativas de uso, seguridad y convivencia para pasajeros y usuarios. Forman parte del paquete legal de Rapa Go y están subordinadas a los Términos y Condiciones Generales.

En caso de discrepancia, prevalecerán los Términos Generales y la legislación aplicable.

2. Registro y cuenta

• Utilizar una cuenta propia, con datos verdaderos y actualizados.

• No compartir credenciales ni permitir su uso por terceros.

• Reportar accesos no autorizados.

• Utilizar la categoría tarifaria que corresponda al pasajero efectivo.

3. Solicitud y punto de retiro

• Ingresar origen y destino correctos antes de confirmar.

• Estar preparado en el punto de retiro.

• Verificar nombre, fotografía, patente, marca y color del vehículo.

• No abordar si existe discrepancia y reportarla inmediatamente.

4. Cancelación y no show

La cancelación es gratuita durante dos minutos desde la aceptación confirmada del conductor. Desde el tercer minuto se cobra 30% del valor del viaje, con tope de $3.000.

El no show se configura cuando el conductor registra llegada y transcurren cinco minutos sin presentación del pasajero; se cobra 50% del valor del viaje, con tope de $5.000.

Las excepciones por seguridad, error de la Plataforma o causa imputable al conductor serán evaluadas por Soporte.

5. Durante el viaje

• Usar cinturón de seguridad y cumplir las normas de tránsito.

• No fumar, consumir sustancias prohibidas, agredir, amenazar ni acosar.

• No exceder la capacidad autorizada.

• No solicitar rutas, paradas o conductas inseguras o ilícitas.

• Mantener limpieza y respeto por el vehículo.

6. Equipaje y objetos especiales

El usuario deberá seleccionar una categoría compatible con maletas u objetos voluminosos. El conductor puede rechazar objetos que comprometan seguridad o dañen el vehículo.

No se admiten pasajeros en zonas de carga. No se ofrecen mascotas, encomiendas ni multidestino en la primera versión.

7. Niños, niñas y adolescentes

La versión inicial no permite que menores viajen sin un adulto acompañante responsable. El adulto deberá proporcionar e instalar el sistema de retención infantil exigido por ley.

8. Pagos, beneficios y devoluciones

El usuario deberá mantener medio de pago y correo vigentes. Los beneficios no son transferibles ni retirables desde la App.

Los pagos en exceso podrán aplicarse a futuros servicios o solicitarse a pagos@rapago.cl o Centro de Ayuda.

9. Seguridad e incidentes

Ante riesgo inmediato, el usuario deberá contactar servicios públicos de emergencia. Posteriormente podrá reportar el caso a Rapa Go con viaje, relato y evidencia.

Rapa Go no sustituye a Carabineros, servicios de salud, Bomberos ni autoridades.

10. Objetos olvidados

El usuario deberá reportar inmediatamente el objeto por Centro de Ayuda, WhatsApp o reclamos@rapago.cl. La recuperación no está garantizada y un desplazamiento adicional puede generar un cargo informado previamente.

11. Calificaciones y comentarios

Las calificaciones deben basarse en experiencias reales. Los comentarios son privados y no deben contener datos personales innecesarios, amenazas, discriminación, falsedades o contenido ilícito.

12. Respeto cultural y territorial

• Respetar sitios sagrados, arqueológicos, privados y restringidos.

• No tocar, remover, intervenir ni dañar patrimonio.

• No solicitar a un conductor que infrinja restricciones territoriales o ambientales.

• Comprender que un viaje de movilidad no incluye tour, permiso, entrada ni guía.

13. Soporte y reclamos

Los canales oficiales son Centro de Ayuda, soporte@rapago.cl, reclamos@rapago.cl y WhatsApp +56 9 4796 4171. La atención humana es de 08:00 a 22:00 horas de Rapa Nui.

14. Incumplimiento

El incumplimiento podrá originar advertencia, cargo válido, investigación, suspensión, bloqueo o cierre de cuenta, según gravedad, reiteración y derechos aplicables.

15. Aceptación y versión

Estas Condiciones se aceptan electrónicamente como anexo subordinado. La aceptación registra usuario, versión, fecha y hora. Toda modificación material requerirá nueva aceptación.

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 1.0

Fecha | 29 de julio de 2026

NATURALEZA DEL DOCUMENTO / Anexo aplicable a pasajeros y usuarios. No reemplaza ni modifica los Términos Generales.

NOTA DE IMPLEMENTACIÓN / Debe mantenerse versionado y aceptarse separadamente solo si la App conserva ese flujo. En caso de contradicción, prevalecen los Términos Generales.

CLÁUSULA DE PREVALENCIA / En caso de contradicción o diferencia interpretativa, prevalecen los Términos y Condiciones Generales de Rapa Go.$rapago_users_v1$,
  '2026-07-29',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM legal_documents
  WHERE type = 'user_conditions' AND version = '1.0'
);

UPDATE legal_documents
SET
  title = 'Condiciones de Usuarios',
  content = $rapago_users_v1$RAPA GO

CONDICIONES DE USUARIOS

Anexo operativo subordinado a los Términos y Condiciones Generales

1. Objeto, subordinación y prevalencia

Estas Condiciones establecen reglas operativas de uso, seguridad y convivencia para pasajeros y usuarios. Forman parte del paquete legal de Rapa Go y están subordinadas a los Términos y Condiciones Generales.

En caso de discrepancia, prevalecerán los Términos Generales y la legislación aplicable.

2. Registro y cuenta

• Utilizar una cuenta propia, con datos verdaderos y actualizados.

• No compartir credenciales ni permitir su uso por terceros.

• Reportar accesos no autorizados.

• Utilizar la categoría tarifaria que corresponda al pasajero efectivo.

3. Solicitud y punto de retiro

• Ingresar origen y destino correctos antes de confirmar.

• Estar preparado en el punto de retiro.

• Verificar nombre, fotografía, patente, marca y color del vehículo.

• No abordar si existe discrepancia y reportarla inmediatamente.

4. Cancelación y no show

La cancelación es gratuita durante dos minutos desde la aceptación confirmada del conductor. Desde el tercer minuto se cobra 30% del valor del viaje, con tope de $3.000.

El no show se configura cuando el conductor registra llegada y transcurren cinco minutos sin presentación del pasajero; se cobra 50% del valor del viaje, con tope de $5.000.

Las excepciones por seguridad, error de la Plataforma o causa imputable al conductor serán evaluadas por Soporte.

5. Durante el viaje

• Usar cinturón de seguridad y cumplir las normas de tránsito.

• No fumar, consumir sustancias prohibidas, agredir, amenazar ni acosar.

• No exceder la capacidad autorizada.

• No solicitar rutas, paradas o conductas inseguras o ilícitas.

• Mantener limpieza y respeto por el vehículo.

6. Equipaje y objetos especiales

El usuario deberá seleccionar una categoría compatible con maletas u objetos voluminosos. El conductor puede rechazar objetos que comprometan seguridad o dañen el vehículo.

No se admiten pasajeros en zonas de carga. No se ofrecen mascotas, encomiendas ni multidestino en la primera versión.

7. Niños, niñas y adolescentes

La versión inicial no permite que menores viajen sin un adulto acompañante responsable. El adulto deberá proporcionar e instalar el sistema de retención infantil exigido por ley.

8. Pagos, beneficios y devoluciones

El usuario deberá mantener medio de pago y correo vigentes. Los beneficios no son transferibles ni retirables desde la App.

Los pagos en exceso podrán aplicarse a futuros servicios o solicitarse a pagos@rapago.cl o Centro de Ayuda.

9. Seguridad e incidentes

Ante riesgo inmediato, el usuario deberá contactar servicios públicos de emergencia. Posteriormente podrá reportar el caso a Rapa Go con viaje, relato y evidencia.

Rapa Go no sustituye a Carabineros, servicios de salud, Bomberos ni autoridades.

10. Objetos olvidados

El usuario deberá reportar inmediatamente el objeto por Centro de Ayuda, WhatsApp o reclamos@rapago.cl. La recuperación no está garantizada y un desplazamiento adicional puede generar un cargo informado previamente.

11. Calificaciones y comentarios

Las calificaciones deben basarse en experiencias reales. Los comentarios son privados y no deben contener datos personales innecesarios, amenazas, discriminación, falsedades o contenido ilícito.

12. Respeto cultural y territorial

• Respetar sitios sagrados, arqueológicos, privados y restringidos.

• No tocar, remover, intervenir ni dañar patrimonio.

• No solicitar a un conductor que infrinja restricciones territoriales o ambientales.

• Comprender que un viaje de movilidad no incluye tour, permiso, entrada ni guía.

13. Soporte y reclamos

Los canales oficiales son Centro de Ayuda, soporte@rapago.cl, reclamos@rapago.cl y WhatsApp +56 9 4796 4171. La atención humana es de 08:00 a 22:00 horas de Rapa Nui.

14. Incumplimiento

El incumplimiento podrá originar advertencia, cargo válido, investigación, suspensión, bloqueo o cierre de cuenta, según gravedad, reiteración y derechos aplicables.

15. Aceptación y versión

Estas Condiciones se aceptan electrónicamente como anexo subordinado. La aceptación registra usuario, versión, fecha y hora. Toda modificación material requerirá nueva aceptación.

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 1.0

Fecha | 29 de julio de 2026

NATURALEZA DEL DOCUMENTO / Anexo aplicable a pasajeros y usuarios. No reemplaza ni modifica los Términos Generales.

NOTA DE IMPLEMENTACIÓN / Debe mantenerse versionado y aceptarse separadamente solo si la App conserva ese flujo. En caso de contradicción, prevalecen los Términos Generales.

CLÁUSULA DE PREVALENCIA / En caso de contradicción o diferencia interpretativa, prevalecen los Términos y Condiciones Generales de Rapa Go.$rapago_users_v1$,
  effective_date = '2026-07-29',
  is_active = true,
  updated_at = NOW()
WHERE type = 'user_conditions' AND version = '1.0';

UPDATE legal_documents
SET is_active = false, updated_at = NOW()
WHERE type = 'driver_conditions' AND is_active = true;

INSERT INTO legal_documents (
  type, version, title, content, effective_date, is_active, created_at, updated_at
)
SELECT
  'driver_conditions',
  '2.0',
  'Contrato de Prestación de Servicios de Conductor Independiente',
  $rapago_driver_v2$RAPA GO

CONTRATO DE PRESTACIÓN DE SERVICIOS

Conductor independiente de plataforma digital

COMPARECENCIA

Entre HAKA TAIKO SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, Isla de Pascua, Chile, representada para estos efectos por quien cuente con facultades vigentes, en adelante “Rapa Go”, la “Plataforma” o la “Empresa”; y la persona natural individualizada en el Anexo N.º 1, en adelante el “Conductor” o el “Prestador”, se celebra el presente Contrato de Prestación de Servicios de Conductor Independiente de Plataforma Digital.

El Conductor declara que los antecedentes incorporados en la App y anexos son auténticos, vigentes y verificables y que mantiene domicilio efectivo y residencia tributaria acreditada en Rapa Nui.

1. Objeto y naturaleza independiente

El Conductor prestará personalmente servicios de movilidad solicitados mediante la App, utilizando un vehículo validado. Rapa Go coordina tecnológicamente el contacto, informa tarifas, procesa o registra pagos y brinda soporte.

El Conductor organiza libremente su disponibilidad, sin exclusividad, turnos obligatorios, mínimo de conexión o viajes. Puede prestar servicios para terceros. La calificación jurídica dependerá de la ejecución real y de la legislación vigente.

2. Territorio y requisitos de incorporación

El servicio se prestará exclusivamente en Rapa Nui. El Conductor deberá ser mayor de dieciocho años y mantener domicilio y residencia tributaria acreditados en el territorio.

Podrán incorporarse personas pertenecientes al Pueblo Rapa Nui, personas legalmente habilitadas para residir y desarrollar actividades económicas y conductores de taxis formalmente autorizados, todos sujetos a requisitos uniformes de seguridad, documentación y capacitación.

El padre o madre de una persona rapanui deberá aportar certificado de nacimiento y acreditar su propia habilitación territorial. El apellido será un antecedente indicativo y no acreditación suficiente por sí solo.

3. Documentación

El Conductor deberá mantener cédula, licencia legalmente habilitante, permiso de circulación, antecedentes, inhabilidades, residencia y documentos tributarios vigentes. Aunque no se carguen separadamente, deberá mantener SOAP y revisión técnica o homologación cuando correspondan.

Deberá informar dentro de veinticuatro horas todo vencimiento, suspensión, pérdida o modificación relevante. Rapa Go podrá bloquear automáticamente por documentos esenciales vencidos o irregulares.

4. Vehículo y conducción personal

Solo podrán utilizarse vehículos registrados. Un vehículo puede asociarse a varios conductores, pero cada persona debe estar individualmente habilitada.

Si el vehículo pertenece a un tercero, se exigirá autorización simple; las empresas operadoras deberán acreditar propiedad, arrendamiento o autorización. Se prohíbe absolutamente que conduzca una persona no registrada.

5. Estándares del vehículo

El vehículo deberá mantenerse limpio, seguro y apto para pasajeros, con cinturones, puertas, luces, neumáticos, vidrios y asientos en condiciones. Rapa Go podrá inspeccionar y suspender el vehículo hasta corregir deficiencias.

6. Cuenta y autenticación

La cuenta es personal e intransferible. El acceso podrá realizarse mediante correo y contraseña, Facebook y, en iOS, Sign in with Apple, cuando se encuentren habilitados. Google Login no forma parte de la primera versión.

Las identidades se vincularán a un único userId y no se fusionarán solo por coincidencia de correo. El Conductor protegerá credenciales y reportará accesos no autorizados.

7. Asignación algorítmica

Las ofertas serán asignadas exclusivamente por algoritmo, a un conductor por vez, considerando proximidad, disponibilidad, categoría, capacidad, equipaje, modalidad y compatibilidad técnica.

La calificación se utilizará para control de calidad y no como criterio automático de asignación. La tasa histórica de rechazo antes de aceptar se excluirá del algoritmo. No existirá asignación manual ordinaria.

8. Información previa y rechazo libre

Antes de aceptar, el Conductor verá identificador del pasajero, origen, destino, categoría, medio de pago, tarifa total al pasajero y requerimientos especiales. La App no estará obligada a mostrar un ingreso estimado del Conductor.

El rechazo antes de aceptar será libre, no requerirá causa y no generará sanción, pérdida de prioridad, suspensión ni afectación de continuidad.

9. Categorías

Las categorías iniciales serán Estándar, XL, Maletas y Express/Prioritario. El Conductor podrá elegir las compatibles con su vehículo. Confort, Encomiendas, Tours, Rent a Car y Eventos permanecerán desactivados hasta habilitación expresa.

10. Conexión y obligación posterior

El Conductor podrá conectarse y desconectarse sin aviso, respetando la franja de desconexión. Una vez aceptado, deberá ejecutar diligentemente o justificar cancelación por accidente, falla, emergencia, riesgo, camino bloqueado o fuerza mayor.

La cancelación quedará registrada con motivo y evidencia disponible.

11. Desconexión mínima

Rapa Go resguardará doce horas continuas de desconexión dentro de cada período de veinticuatro horas. El Conductor elegirá una franja diaria y podrá modificarla mediante conductores@rapago.cl con veinticuatro horas de anticipación.

Durante la franja no se enviarán ofertas. Si existe viaje en curso, podrá finalizarlo y luego comenzará el bloqueo automático o administrativo registrado.

12. Conducta, cultura y privacidad del pasajero

El Conductor deberá mantener trato respetuoso, no discriminatorio y profesional; respetar cultura y patrimonio Rapa Nui; y usar los datos del pasajero únicamente para ejecutar el viaje.

Se prohíbe conservar o usar datos para contacto posterior, captar servicios fuera de la App, ofrecer tours no habilitados o promover ingreso a zonas restringidas.

13. Tarifa, Comisión e ingreso

Rapa Go determina la tarifa. La Comisión total será 23% de la tarifa, IVA incluido. El Conductor tendrá derecho al 77% restante antes del tratamiento tributario aplicable.

La Comisión se aplicará a recargos Express. Promociones financiadas por Rapa Go no reducirán el monto derivado de la tarifa informada al aceptar.

14. Incentivos

Rapa Go podrá ofrecer campañas voluntarias con pagos monetarios, viajes u otros beneficios. Cada campaña informará vigencia, condiciones y cálculo. No constituyen derecho permanente ni pueden sancionar el rechazo o falta de conexión.

15. Cancelación y no show

En una cancelación ordinaria, el pasajero podrá ser cargado con 30% del viaje, tope $3.000. Si el Conductor ya llegó al punto de retiro y el cargo es efectivamente cobrado, 50% corresponderá al Conductor y 50% a Rapa Go, sin Comisión adicional sobre la parte del Conductor.

En no show, el pasajero será cargado con 50% del viaje, tope $5.000, siempre que el Conductor registre llegada y espere cinco minutos. El cargo se distribuirá 50% para el Conductor y 50% para Rapa Go, sin Comisión adicional sobre la parte del Conductor.

No habrá participación del Conductor cuando no exista llegada verificable o el cargo sea anulado por causa imputable al Conductor o a la Plataforma.

16. Tiempo efectivo y mínimo legal

El tiempo efectivo comienza cuando el Conductor acepta y comienza el desplazamiento y finaliza cuando completa el servicio y el sistema valida su término.

En cancelaciones posteriores se registrará el tiempo entre aceptación y cancelación. Si es imputable al Conductor, podrá excluirse mediante decisión fundada.

Rapa Go verificará en cada período de pago que el honorario por hora efectiva no sea inferior al ingreso mínimo legal por hora incrementado en 20%, y pagará la diferencia cuando corresponda. Soporte y Contabilidad revisarán semanalmente y enviarán informe mensual.

17. Liquidaciones y pagos

El período será semanal, lunes a domingo, cierre domingo 23:59 hora Rapa Nui, transferencia el lunes o día hábil inmediato.

La liquidación detallará viajes, tarifa, medio, Comisión, cancelaciones, no show, ajustes, tratamiento tributario, saldos y total. El Conductor podrá objetar en cinco días hábiles; solo se suspenderá el monto controvertido.

18. Efectivo y saldos adeudados

En efectivo, el Conductor recibe el pago y queda registrada la Comisión. Los saldos se compensan con liquidaciones futuras. Si no hay fondos o termina el contrato, deberá transferir a Haka Taiko SpA dentro de tres días hábiles desde el requerimiento.

Los datos bancarios se informarán por canales oficiales y el comprobante se enviará a pagos@rapago.cl. Un saldo vencido por más de tres días hábiles o dos períodos consecutivos podrá originar suspensión temporal.

19. Documentación tributaria

El Conductor emitirá una boleta mensual a Haka Taiko SpA que documentará todos los pagos semanales. Se emitirá el primer día hábil del mes siguiente; habrá un plazo adicional de tres días y luego podrá suspenderse la cuenta.

La retención, exención o tratamiento se aplicará según residencia tributaria acreditada y normativa vigente. El Conductor deberá informar cualquier cambio.

20. Datos personales y acceso

Rapa Go tratará datos para registro, asignación, pagos, seguridad, soporte, fraude, investigación y cumplimiento conforme a la Política de Privacidad.

El historial de viajes y calificaciones estará en la App. Contrato, liquidaciones y horas se enviarán por correo. El contrato vigente permanecerá visible o descargable dentro de la cuenta.

El Conductor podrá solicitar acceso y portabilidad a privacidad@rapago.cl; cuando no exista descarga automática, se responderá dentro de quince días hábiles.

21. Geolocalización

La ubicación podrá tratarse durante disponibilidad, asignación y viaje. La última coordenada previa se conservará hasta quince minutos. Durante viaje activo podrá continuar en segundo plano y terminará al completar, cancelar, cerrar sesión o revocar permiso.

Rutas ordinarias podrán conservarse hasta un año; accidentes, fraude, reclamos o investigaciones hasta cinco años o el plazo legal aplicable.

22. Algoritmo y revisión humana

Los mecanismos automatizados no utilizarán pertenencia étnica, nacionalidad, rechazo previo ni falta de conexión como factores sancionatorios.

Cuando una decisión afecte continuidad, el Conductor podrá conocer fundamentos esenciales y solicitar revisión humana, resguardando datos de terceros.

23. Calificaciones

Una baja calificación no producirá suspensión automática. Soporte revisará contexto, número de viajes, reclamos y comentarios privados y podrá adoptar capacitación, advertencia o investigación.

24. Canal de reclamos

El canal oficial será conductores@rapago.cl, teléfono +56 9 4796 4171 y atención física en Miru s/n, Isla de Pascua, de lunes a viernes de 08:00 a 18:00 horas, salvo feriados.

El Encargado de Gestión de Reclamos y su suplente se informarán en ficha actualizable. Rapa Go acusará recibo; procurará responder asuntos simples en tres días hábiles, complejos en cinco e investigaciones en diez, prorrogables fundadamente.

25. Investigación, suspensión y apelación

Ante posible incumplimiento se notificará y otorgarán cuarenta y ocho horas para descargos, salvo riesgo grave que justifique suspensión preventiva inmediata.

Soporte/Administrador resolverá fundadamente. El Conductor podrá apelar en tres días hábiles y Gerencia Legal resolverá.

Los montos devengados seguirán pagándose, salvo los directamente vinculados a fraude o controversia documentada.

26. Cancelaciones injustificadas

Cada tres cancelaciones injustificadas posteriores a la aceptación dentro de treinta días móviles podrán originar: primera ocurrencia, suspensión de siete días; segunda, treinta días; tercera, terminación.

No se considerarán injustificadas las cancelaciones por accidente, falla, emergencia, riesgo, bloqueo de camino, fuerza mayor u otra causa objetiva.

27. Incumplimientos graves

Podrán constituir incumplimientos graves: documentación falsa; conductor no autorizado; licencia vencida, suspendida o cancelada; fraude; manipulación de pagos; agresión, acoso, amenaza o discriminación; accidente grave no informado; captación reiterada para eludir la App; cobros externos; uso indebido de datos; transporte inseguro; daño cultural o patrimonial grave; reincidencia posterior a suspensiones; y otros incumplimientos legales graves.

La decisión será fundada y reclamable.

28. Terminación

El Conductor podrá terminar mediante correo a conductores@rapago.cl sin aviso previo obligatorio. Rapa Go notificará con treinta días de anticipación cuando corresponda conforme a la normativa vigente, salvo incumplimiento grave.

La terminación no impedirá pago de honorarios devengados ni devolución de saldos.

29. Accidentes e incidentes

El Conductor priorizará la seguridad, contactará servicios públicos y reportará a Rapa Go. Enviará ubicación, fotografías, patente, relato y parte policial cuando exista.

Un accidente grave podrá producir suspensión preventiva. El Conductor asumirá el reembolso al pasajero cuando la imposibilidad de completar sea imputable a su conducta o vehículo, previa determinación fundada.

El Conductor responde por conducción y Ley de Tránsito, sin perjuicio de responsabilidades propias de Haka Taiko SpA.

30. Capacitación

Antes de activarse deberá aprobar capacitación sobre App, seguridad vial, privacidad, trato, prevención de acoso, accidentes, objetos olvidados, cultura y patrimonio Rapa Nui, pagos y baja conectividad. Se actualizará cuando cambien protocolos relevantes.

31. Seguro de bienes utilizados

Rapa Go proporcionará la cobertura de seguro sobre bienes personales utilizados por el Conductor que resulte exigida por la normativa vigente, con cobertura mínima y condiciones legales.

La póliza, asegurador, bienes, exclusiones, vigencia y siniestros se individualizarán en un anexo antes de la habilitación efectiva. La aceptación del contrato no constituye declaración de existencia de una póliza mientras el anexo no haya sido emitido.

32. Propiedad intelectual y uso de la App

Rapa Go concede licencia personal, revocable, no exclusiva e intransferible durante la vigencia. Se prohíbe copiar, descompilar, extraer datos, manipular geolocalización, tarifas o controles.

33. Confidencialidad y desintermediación

El Conductor usará datos del pasajero solo para el viaje y no podrá contactarlo posteriormente sin causa legítima, compartir datos, cobrar precio distinto ni captar servicios para eludir Comisión, trazabilidad o seguridad.

34. Fuerza mayor y conectividad

La operación depende de internet, GPS, energía, clima, caminos y servicios de terceros. La falla temporal no autoriza cobros no informados ni elimina el deber de reportar incidentes.

35. Cesión

El Conductor autoriza anticipadamente que Haka Taiko SpA ceda su posición contractual a RAPA GO SPA cuando esté legal, tributaria y operativamente habilitada. Se notificará por correo y App, sin afectar derechos devengados.

Toda modificación material adicional requerirá aceptación expresa.

36. Modificaciones y campañas

Las modificaciones materiales serán informadas y aceptadas electrónicamente. Datos de contacto, responsables, campañas temporales y cambios que no alteren derechos esenciales podrán comunicarse mediante fichas o avisos.

37. Aceptación, entrega y disponibilidad

El Conductor aceptará mediante casilla no preseleccionada y botón “Acepto el Contrato de Prestación de Servicios”. El sistema registrará versión, fecha, hora y usuario.

Rapa Go enviará una copia PDF al correo y mantendrá el contrato disponible para ver o descargar dentro de la cuenta. La habilitación solo ocurrirá después de validación y condiciones previas.

38. Cierre de cuenta y conservación

El Conductor podrá solicitar cierre desde la App o canal oficial. Podrá aplazarse por viajes activos, saldo, boleta pendiente, investigación o deber de conservación.

El cierre no extingue obligaciones ni pagos. Contratos, aceptaciones, liquidaciones, reclamos e incidentes podrán conservarse hasta cinco años o el plazo legal aplicable.

39. Ley aplicable y competencia

El contrato se rige por las leyes chilenas. Se fija domicilio para comunicaciones en Miru s/n, Isla de Pascua. La competencia será la determinada legalmente y no se limitarán derechos irrenunciables.

40. Integridad

El contrato y anexos contienen el acuerdo para el Conductor persona natural. La nulidad de una cláusula no afecta las restantes. Las empresas operadoras deberán celebrar un contrato comercial separado.

ANEXO N.º 1 · INDIVIDUALIZACIÓN DEL CONDUCTOR

Vehículo asociado

ANEXO N.º 2 · CONDICIONES ECONÓMICAS

ANEXO N.º 3 · FRANJA DE DESCONEXIÓN

La modificación deberá solicitarse a conductores@rapago.cl con al menos veinticuatro horas de anticipación.

ANEXO N.º 4 · DOCUMENTOS Y DECLARACIONES

[ ] Cédula vigente.

[ ] Licencia vigente.

[ ] Permiso de circulación vigente.

[ ] Certificado de antecedentes de hasta 30 días.

[ ] Verificación de inhabilidades.

[ ] Fotografía.

[ ] Datos bancarios.

[ ] Residencia y domicilio tributario en Rapa Nui.

[ ] Declaración de pertenencia rapanui o habilitación territorial.

[ ] Certificado de nacimiento cuando corresponda.

[ ] Autorización de uso si el vehículo es de tercero.

Declaraciones

[ ] Los antecedentes son auténticos y vigentes.

[ ] Mantendré toda documentación legal del vehículo.

[ ] No permitiré conducción por persona no habilitada.

[ ] Informaré cambios relevantes dentro de 24 horas.

[ ] Cumpliré seguridad, privacidad y respeto cultural.

ANEXO N.º 5 · CANAL DE RECLAMOS

ANEXO N.º 6 · REGISTRO DE ACEPTACIÓN

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 2.0

Fecha | 29 de julio de 2026

NATURALEZA DEL DOCUMENTO / Contrato aplicable exclusivamente a conductores personas naturales. Las empresas operadoras requieren un contrato comercial separado.

NOTA DE IMPLEMENTACIÓN / La habilitación efectiva exige validación documental, capacitación, franja de desconexión, aceptación electrónica, disponibilidad del contrato en la App y cobertura legalmente exigible de bienes utilizados.

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

Patente |

Marca / modelo |

Año |

Color |

Titular |

Permiso de circulación vence |

Categorías |

Materia | Condición

Comisión | 23% de la tarifa total, IVA incluido.

Participación ordinaria | 77% antes del tratamiento tributario.

Express/Prioritario | Comisión sobre tarifa total incluido recargo.

Cancelación ordinaria | 30% del viaje, tope $3.000. Si el Conductor llegó y el cargo se cobra: 50% Conductor / 50% Rapa Go.

No show | 50% del viaje, tope $5.000, tras llegada y 5 minutos. 50% Conductor / 50% Rapa Go.

Liquidación | Semanal, lunes a domingo; transferencia lunes siguiente.

Objeción | 5 días hábiles.

Boleta | Mensual, primer día hábil; 3 días adicionales.

Saldo adeudado | Compensación o transferencia en 3 días hábiles.

Hora de inicio |

Hora de término |

Fecha desde la que rige |

Observaciones |

Materia | Canal oficial

Correo | conductores@rapago.cl

Teléfono | +56 9 4796 4171

Lugar físico | Miru s/n, Isla de Pascua

Horario | Lunes a viernes, 08:00 a 18:00 horas, salvo feriados

Primera instancia | Soporte / Administrador de la App

Apelación | Gerencia Legal

Responsable titular | Encargado de Gestión de Reclamos, informado en ficha vigente

Suplente | Segundo integrante del equipo, informado en ficha vigente

Versión | 2.0

Identificador del Conductor |

Fecha y hora |

Usuario/cuenta |

Correo de envío PDF |

Contrato disponible en App | Sí / No

Capacitación aprobada | Sí / No

Validación documental | Sí / No

Anexo de seguro emitido | Sí / No

Habilitación efectiva | Sí / No

DECLARACIÓN DE ACEPTACIÓN / Al seleccionar “Acepto el Contrato de Prestación de Servicios”, el Conductor declara haber leído y comprendido el contrato y anexos, confirma la veracidad de sus antecedentes y reconoce que la habilitación depende de las condiciones previas.$rapago_driver_v2$,
  '2026-07-29',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM legal_documents
  WHERE type = 'driver_conditions' AND version = '2.0'
);

UPDATE legal_documents
SET
  title = 'Contrato de Prestación de Servicios de Conductor Independiente',
  content = $rapago_driver_v2$RAPA GO

CONTRATO DE PRESTACIÓN DE SERVICIOS

Conductor independiente de plataforma digital

COMPARECENCIA

Entre HAKA TAIKO SpA, RUT N.º 77.930.635-6, con domicilio en Miru s/n, Isla de Pascua, Chile, representada para estos efectos por quien cuente con facultades vigentes, en adelante “Rapa Go”, la “Plataforma” o la “Empresa”; y la persona natural individualizada en el Anexo N.º 1, en adelante el “Conductor” o el “Prestador”, se celebra el presente Contrato de Prestación de Servicios de Conductor Independiente de Plataforma Digital.

El Conductor declara que los antecedentes incorporados en la App y anexos son auténticos, vigentes y verificables y que mantiene domicilio efectivo y residencia tributaria acreditada en Rapa Nui.

1. Objeto y naturaleza independiente

El Conductor prestará personalmente servicios de movilidad solicitados mediante la App, utilizando un vehículo validado. Rapa Go coordina tecnológicamente el contacto, informa tarifas, procesa o registra pagos y brinda soporte.

El Conductor organiza libremente su disponibilidad, sin exclusividad, turnos obligatorios, mínimo de conexión o viajes. Puede prestar servicios para terceros. La calificación jurídica dependerá de la ejecución real y de la legislación vigente.

2. Territorio y requisitos de incorporación

El servicio se prestará exclusivamente en Rapa Nui. El Conductor deberá ser mayor de dieciocho años y mantener domicilio y residencia tributaria acreditados en el territorio.

Podrán incorporarse personas pertenecientes al Pueblo Rapa Nui, personas legalmente habilitadas para residir y desarrollar actividades económicas y conductores de taxis formalmente autorizados, todos sujetos a requisitos uniformes de seguridad, documentación y capacitación.

El padre o madre de una persona rapanui deberá aportar certificado de nacimiento y acreditar su propia habilitación territorial. El apellido será un antecedente indicativo y no acreditación suficiente por sí solo.

3. Documentación

El Conductor deberá mantener cédula, licencia legalmente habilitante, permiso de circulación, antecedentes, inhabilidades, residencia y documentos tributarios vigentes. Aunque no se carguen separadamente, deberá mantener SOAP y revisión técnica o homologación cuando correspondan.

Deberá informar dentro de veinticuatro horas todo vencimiento, suspensión, pérdida o modificación relevante. Rapa Go podrá bloquear automáticamente por documentos esenciales vencidos o irregulares.

4. Vehículo y conducción personal

Solo podrán utilizarse vehículos registrados. Un vehículo puede asociarse a varios conductores, pero cada persona debe estar individualmente habilitada.

Si el vehículo pertenece a un tercero, se exigirá autorización simple; las empresas operadoras deberán acreditar propiedad, arrendamiento o autorización. Se prohíbe absolutamente que conduzca una persona no registrada.

5. Estándares del vehículo

El vehículo deberá mantenerse limpio, seguro y apto para pasajeros, con cinturones, puertas, luces, neumáticos, vidrios y asientos en condiciones. Rapa Go podrá inspeccionar y suspender el vehículo hasta corregir deficiencias.

6. Cuenta y autenticación

La cuenta es personal e intransferible. El acceso podrá realizarse mediante correo y contraseña, Facebook y, en iOS, Sign in with Apple, cuando se encuentren habilitados. Google Login no forma parte de la primera versión.

Las identidades se vincularán a un único userId y no se fusionarán solo por coincidencia de correo. El Conductor protegerá credenciales y reportará accesos no autorizados.

7. Asignación algorítmica

Las ofertas serán asignadas exclusivamente por algoritmo, a un conductor por vez, considerando proximidad, disponibilidad, categoría, capacidad, equipaje, modalidad y compatibilidad técnica.

La calificación se utilizará para control de calidad y no como criterio automático de asignación. La tasa histórica de rechazo antes de aceptar se excluirá del algoritmo. No existirá asignación manual ordinaria.

8. Información previa y rechazo libre

Antes de aceptar, el Conductor verá identificador del pasajero, origen, destino, categoría, medio de pago, tarifa total al pasajero y requerimientos especiales. La App no estará obligada a mostrar un ingreso estimado del Conductor.

El rechazo antes de aceptar será libre, no requerirá causa y no generará sanción, pérdida de prioridad, suspensión ni afectación de continuidad.

9. Categorías

Las categorías iniciales serán Estándar, XL, Maletas y Express/Prioritario. El Conductor podrá elegir las compatibles con su vehículo. Confort, Encomiendas, Tours, Rent a Car y Eventos permanecerán desactivados hasta habilitación expresa.

10. Conexión y obligación posterior

El Conductor podrá conectarse y desconectarse sin aviso, respetando la franja de desconexión. Una vez aceptado, deberá ejecutar diligentemente o justificar cancelación por accidente, falla, emergencia, riesgo, camino bloqueado o fuerza mayor.

La cancelación quedará registrada con motivo y evidencia disponible.

11. Desconexión mínima

Rapa Go resguardará doce horas continuas de desconexión dentro de cada período de veinticuatro horas. El Conductor elegirá una franja diaria y podrá modificarla mediante conductores@rapago.cl con veinticuatro horas de anticipación.

Durante la franja no se enviarán ofertas. Si existe viaje en curso, podrá finalizarlo y luego comenzará el bloqueo automático o administrativo registrado.

12. Conducta, cultura y privacidad del pasajero

El Conductor deberá mantener trato respetuoso, no discriminatorio y profesional; respetar cultura y patrimonio Rapa Nui; y usar los datos del pasajero únicamente para ejecutar el viaje.

Se prohíbe conservar o usar datos para contacto posterior, captar servicios fuera de la App, ofrecer tours no habilitados o promover ingreso a zonas restringidas.

13. Tarifa, Comisión e ingreso

Rapa Go determina la tarifa. La Comisión total será 23% de la tarifa, IVA incluido. El Conductor tendrá derecho al 77% restante antes del tratamiento tributario aplicable.

La Comisión se aplicará a recargos Express. Promociones financiadas por Rapa Go no reducirán el monto derivado de la tarifa informada al aceptar.

14. Incentivos

Rapa Go podrá ofrecer campañas voluntarias con pagos monetarios, viajes u otros beneficios. Cada campaña informará vigencia, condiciones y cálculo. No constituyen derecho permanente ni pueden sancionar el rechazo o falta de conexión.

15. Cancelación y no show

En una cancelación ordinaria, el pasajero podrá ser cargado con 30% del viaje, tope $3.000. Si el Conductor ya llegó al punto de retiro y el cargo es efectivamente cobrado, 50% corresponderá al Conductor y 50% a Rapa Go, sin Comisión adicional sobre la parte del Conductor.

En no show, el pasajero será cargado con 50% del viaje, tope $5.000, siempre que el Conductor registre llegada y espere cinco minutos. El cargo se distribuirá 50% para el Conductor y 50% para Rapa Go, sin Comisión adicional sobre la parte del Conductor.

No habrá participación del Conductor cuando no exista llegada verificable o el cargo sea anulado por causa imputable al Conductor o a la Plataforma.

16. Tiempo efectivo y mínimo legal

El tiempo efectivo comienza cuando el Conductor acepta y comienza el desplazamiento y finaliza cuando completa el servicio y el sistema valida su término.

En cancelaciones posteriores se registrará el tiempo entre aceptación y cancelación. Si es imputable al Conductor, podrá excluirse mediante decisión fundada.

Rapa Go verificará en cada período de pago que el honorario por hora efectiva no sea inferior al ingreso mínimo legal por hora incrementado en 20%, y pagará la diferencia cuando corresponda. Soporte y Contabilidad revisarán semanalmente y enviarán informe mensual.

17. Liquidaciones y pagos

El período será semanal, lunes a domingo, cierre domingo 23:59 hora Rapa Nui, transferencia el lunes o día hábil inmediato.

La liquidación detallará viajes, tarifa, medio, Comisión, cancelaciones, no show, ajustes, tratamiento tributario, saldos y total. El Conductor podrá objetar en cinco días hábiles; solo se suspenderá el monto controvertido.

18. Efectivo y saldos adeudados

En efectivo, el Conductor recibe el pago y queda registrada la Comisión. Los saldos se compensan con liquidaciones futuras. Si no hay fondos o termina el contrato, deberá transferir a Haka Taiko SpA dentro de tres días hábiles desde el requerimiento.

Los datos bancarios se informarán por canales oficiales y el comprobante se enviará a pagos@rapago.cl. Un saldo vencido por más de tres días hábiles o dos períodos consecutivos podrá originar suspensión temporal.

19. Documentación tributaria

El Conductor emitirá una boleta mensual a Haka Taiko SpA que documentará todos los pagos semanales. Se emitirá el primer día hábil del mes siguiente; habrá un plazo adicional de tres días y luego podrá suspenderse la cuenta.

La retención, exención o tratamiento se aplicará según residencia tributaria acreditada y normativa vigente. El Conductor deberá informar cualquier cambio.

20. Datos personales y acceso

Rapa Go tratará datos para registro, asignación, pagos, seguridad, soporte, fraude, investigación y cumplimiento conforme a la Política de Privacidad.

El historial de viajes y calificaciones estará en la App. Contrato, liquidaciones y horas se enviarán por correo. El contrato vigente permanecerá visible o descargable dentro de la cuenta.

El Conductor podrá solicitar acceso y portabilidad a privacidad@rapago.cl; cuando no exista descarga automática, se responderá dentro de quince días hábiles.

21. Geolocalización

La ubicación podrá tratarse durante disponibilidad, asignación y viaje. La última coordenada previa se conservará hasta quince minutos. Durante viaje activo podrá continuar en segundo plano y terminará al completar, cancelar, cerrar sesión o revocar permiso.

Rutas ordinarias podrán conservarse hasta un año; accidentes, fraude, reclamos o investigaciones hasta cinco años o el plazo legal aplicable.

22. Algoritmo y revisión humana

Los mecanismos automatizados no utilizarán pertenencia étnica, nacionalidad, rechazo previo ni falta de conexión como factores sancionatorios.

Cuando una decisión afecte continuidad, el Conductor podrá conocer fundamentos esenciales y solicitar revisión humana, resguardando datos de terceros.

23. Calificaciones

Una baja calificación no producirá suspensión automática. Soporte revisará contexto, número de viajes, reclamos y comentarios privados y podrá adoptar capacitación, advertencia o investigación.

24. Canal de reclamos

El canal oficial será conductores@rapago.cl, teléfono +56 9 4796 4171 y atención física en Miru s/n, Isla de Pascua, de lunes a viernes de 08:00 a 18:00 horas, salvo feriados.

El Encargado de Gestión de Reclamos y su suplente se informarán en ficha actualizable. Rapa Go acusará recibo; procurará responder asuntos simples en tres días hábiles, complejos en cinco e investigaciones en diez, prorrogables fundadamente.

25. Investigación, suspensión y apelación

Ante posible incumplimiento se notificará y otorgarán cuarenta y ocho horas para descargos, salvo riesgo grave que justifique suspensión preventiva inmediata.

Soporte/Administrador resolverá fundadamente. El Conductor podrá apelar en tres días hábiles y Gerencia Legal resolverá.

Los montos devengados seguirán pagándose, salvo los directamente vinculados a fraude o controversia documentada.

26. Cancelaciones injustificadas

Cada tres cancelaciones injustificadas posteriores a la aceptación dentro de treinta días móviles podrán originar: primera ocurrencia, suspensión de siete días; segunda, treinta días; tercera, terminación.

No se considerarán injustificadas las cancelaciones por accidente, falla, emergencia, riesgo, bloqueo de camino, fuerza mayor u otra causa objetiva.

27. Incumplimientos graves

Podrán constituir incumplimientos graves: documentación falsa; conductor no autorizado; licencia vencida, suspendida o cancelada; fraude; manipulación de pagos; agresión, acoso, amenaza o discriminación; accidente grave no informado; captación reiterada para eludir la App; cobros externos; uso indebido de datos; transporte inseguro; daño cultural o patrimonial grave; reincidencia posterior a suspensiones; y otros incumplimientos legales graves.

La decisión será fundada y reclamable.

28. Terminación

El Conductor podrá terminar mediante correo a conductores@rapago.cl sin aviso previo obligatorio. Rapa Go notificará con treinta días de anticipación cuando corresponda conforme a la normativa vigente, salvo incumplimiento grave.

La terminación no impedirá pago de honorarios devengados ni devolución de saldos.

29. Accidentes e incidentes

El Conductor priorizará la seguridad, contactará servicios públicos y reportará a Rapa Go. Enviará ubicación, fotografías, patente, relato y parte policial cuando exista.

Un accidente grave podrá producir suspensión preventiva. El Conductor asumirá el reembolso al pasajero cuando la imposibilidad de completar sea imputable a su conducta o vehículo, previa determinación fundada.

El Conductor responde por conducción y Ley de Tránsito, sin perjuicio de responsabilidades propias de Haka Taiko SpA.

30. Capacitación

Antes de activarse deberá aprobar capacitación sobre App, seguridad vial, privacidad, trato, prevención de acoso, accidentes, objetos olvidados, cultura y patrimonio Rapa Nui, pagos y baja conectividad. Se actualizará cuando cambien protocolos relevantes.

31. Seguro de bienes utilizados

Rapa Go proporcionará la cobertura de seguro sobre bienes personales utilizados por el Conductor que resulte exigida por la normativa vigente, con cobertura mínima y condiciones legales.

La póliza, asegurador, bienes, exclusiones, vigencia y siniestros se individualizarán en un anexo antes de la habilitación efectiva. La aceptación del contrato no constituye declaración de existencia de una póliza mientras el anexo no haya sido emitido.

32. Propiedad intelectual y uso de la App

Rapa Go concede licencia personal, revocable, no exclusiva e intransferible durante la vigencia. Se prohíbe copiar, descompilar, extraer datos, manipular geolocalización, tarifas o controles.

33. Confidencialidad y desintermediación

El Conductor usará datos del pasajero solo para el viaje y no podrá contactarlo posteriormente sin causa legítima, compartir datos, cobrar precio distinto ni captar servicios para eludir Comisión, trazabilidad o seguridad.

34. Fuerza mayor y conectividad

La operación depende de internet, GPS, energía, clima, caminos y servicios de terceros. La falla temporal no autoriza cobros no informados ni elimina el deber de reportar incidentes.

35. Cesión

El Conductor autoriza anticipadamente que Haka Taiko SpA ceda su posición contractual a RAPA GO SPA cuando esté legal, tributaria y operativamente habilitada. Se notificará por correo y App, sin afectar derechos devengados.

Toda modificación material adicional requerirá aceptación expresa.

36. Modificaciones y campañas

Las modificaciones materiales serán informadas y aceptadas electrónicamente. Datos de contacto, responsables, campañas temporales y cambios que no alteren derechos esenciales podrán comunicarse mediante fichas o avisos.

37. Aceptación, entrega y disponibilidad

El Conductor aceptará mediante casilla no preseleccionada y botón “Acepto el Contrato de Prestación de Servicios”. El sistema registrará versión, fecha, hora y usuario.

Rapa Go enviará una copia PDF al correo y mantendrá el contrato disponible para ver o descargar dentro de la cuenta. La habilitación solo ocurrirá después de validación y condiciones previas.

38. Cierre de cuenta y conservación

El Conductor podrá solicitar cierre desde la App o canal oficial. Podrá aplazarse por viajes activos, saldo, boleta pendiente, investigación o deber de conservación.

El cierre no extingue obligaciones ni pagos. Contratos, aceptaciones, liquidaciones, reclamos e incidentes podrán conservarse hasta cinco años o el plazo legal aplicable.

39. Ley aplicable y competencia

El contrato se rige por las leyes chilenas. Se fija domicilio para comunicaciones en Miru s/n, Isla de Pascua. La competencia será la determinada legalmente y no se limitarán derechos irrenunciables.

40. Integridad

El contrato y anexos contienen el acuerdo para el Conductor persona natural. La nulidad de una cláusula no afecta las restantes. Las empresas operadoras deberán celebrar un contrato comercial separado.

ANEXO N.º 1 · INDIVIDUALIZACIÓN DEL CONDUCTOR

Vehículo asociado

ANEXO N.º 2 · CONDICIONES ECONÓMICAS

ANEXO N.º 3 · FRANJA DE DESCONEXIÓN

La modificación deberá solicitarse a conductores@rapago.cl con al menos veinticuatro horas de anticipación.

ANEXO N.º 4 · DOCUMENTOS Y DECLARACIONES

[ ] Cédula vigente.

[ ] Licencia vigente.

[ ] Permiso de circulación vigente.

[ ] Certificado de antecedentes de hasta 30 días.

[ ] Verificación de inhabilidades.

[ ] Fotografía.

[ ] Datos bancarios.

[ ] Residencia y domicilio tributario en Rapa Nui.

[ ] Declaración de pertenencia rapanui o habilitación territorial.

[ ] Certificado de nacimiento cuando corresponda.

[ ] Autorización de uso si el vehículo es de tercero.

Declaraciones

[ ] Los antecedentes son auténticos y vigentes.

[ ] Mantendré toda documentación legal del vehículo.

[ ] No permitiré conducción por persona no habilitada.

[ ] Informaré cambios relevantes dentro de 24 horas.

[ ] Cumpliré seguridad, privacidad y respeto cultural.

ANEXO N.º 5 · CANAL DE RECLAMOS

ANEXO N.º 6 · REGISTRO DE ACEPTACIÓN

Operador | Haka Taiko SpA

Marca | Rapa Go

RUT | 77.930.635-6

Domicilio | Miru s/n, Isla de Pascua, Chile

Versión | 2.0

Fecha | 29 de julio de 2026

NATURALEZA DEL DOCUMENTO / Contrato aplicable exclusivamente a conductores personas naturales. Las empresas operadoras requieren un contrato comercial separado.

NOTA DE IMPLEMENTACIÓN / La habilitación efectiva exige validación documental, capacitación, franja de desconexión, aceptación electrónica, disponibilidad del contrato en la App y cobertura legalmente exigible de bienes utilizados.

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

Patente |

Marca / modelo |

Año |

Color |

Titular |

Permiso de circulación vence |

Categorías |

Materia | Condición

Comisión | 23% de la tarifa total, IVA incluido.

Participación ordinaria | 77% antes del tratamiento tributario.

Express/Prioritario | Comisión sobre tarifa total incluido recargo.

Cancelación ordinaria | 30% del viaje, tope $3.000. Si el Conductor llegó y el cargo se cobra: 50% Conductor / 50% Rapa Go.

No show | 50% del viaje, tope $5.000, tras llegada y 5 minutos. 50% Conductor / 50% Rapa Go.

Liquidación | Semanal, lunes a domingo; transferencia lunes siguiente.

Objeción | 5 días hábiles.

Boleta | Mensual, primer día hábil; 3 días adicionales.

Saldo adeudado | Compensación o transferencia en 3 días hábiles.

Hora de inicio |

Hora de término |

Fecha desde la que rige |

Observaciones |

Materia | Canal oficial

Correo | conductores@rapago.cl

Teléfono | +56 9 4796 4171

Lugar físico | Miru s/n, Isla de Pascua

Horario | Lunes a viernes, 08:00 a 18:00 horas, salvo feriados

Primera instancia | Soporte / Administrador de la App

Apelación | Gerencia Legal

Responsable titular | Encargado de Gestión de Reclamos, informado en ficha vigente

Suplente | Segundo integrante del equipo, informado en ficha vigente

Versión | 2.0

Identificador del Conductor |

Fecha y hora |

Usuario/cuenta |

Correo de envío PDF |

Contrato disponible en App | Sí / No

Capacitación aprobada | Sí / No

Validación documental | Sí / No

Anexo de seguro emitido | Sí / No

Habilitación efectiva | Sí / No

DECLARACIÓN DE ACEPTACIÓN / Al seleccionar “Acepto el Contrato de Prestación de Servicios”, el Conductor declara haber leído y comprendido el contrato y anexos, confirma la veracidad de sus antecedentes y reconoce que la habilitación depende de las condiciones previas.$rapago_driver_v2$,
  effective_date = '2026-07-29',
  is_active = true,
  updated_at = NOW()
WHERE type = 'driver_conditions' AND version = '2.0';

COMMIT;
