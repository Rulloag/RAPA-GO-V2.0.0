# Google Play Data Safety — borrador de trabajo

Este documento no sustituye la declaración final de Play Console. Debe compararse con la build firmada y la Política de Privacidad.

## Datos tratados por funciones activas

- Información de cuenta: nombre, correo, teléfono e identificador de usuario.
- Identificación/verificación cuando corresponda: RUT, pasaporte o documento de residencia.
- Ubicación aproximada/precisa para origen, asignación y viaje activo.
- Historial de viajes, estados, tarifas y cancelaciones.
- Identificadores de pago y estado de transacción; no se almacena número completo de tarjeta ni CVV.
- Fotografías y documentos del conductor/vehículo para habilitación.
- Soporte, reclamos, calificaciones y comentarios según visibilidad configurada.
- Información técnica mínima: IP, user-agent, registros de seguridad y diagnóstico configurado.

## Finalidades

Funcionamiento de la app, prevención de fraude, seguridad, soporte, cumplimiento legal, pagos y mejora operacional.

## Controles

- Cifrado en tránsito.
- Token de sesión en almacenamiento seguro nativo.
- Eliminación de sesión al cerrar cuenta o revocar acceso.
- Página pública y flujo dentro de la app para eliminación.
- Módulos de turismo, arriendo y eventos desactivados en esta versión.

## Revisión obligatoria

Confirmar en el AAB final los SDK activos mediante Android Studio/App Bundle Explorer y reconciliar el resultado con `docs/privacy/PROVIDERS_AND_SDK.md`.
