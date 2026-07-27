# Notas para revisión de Google Play — plantilla

## Aplicación

- Nombre: RAPA GO
- Package ID: `cl.rapago.app`
- Versión: completar desde el AAB enviado
- Operador: Haka Taiko SpA

## Objetivo

Aplicación de movilidad local en Rapa Nui para solicitar y gestionar viajes entre pasajeros y conductores habilitados.

## Cuentas de revisión

Usar exclusivamente las cuentas registradas en `TEST_ACCOUNTS_TEMPLATE.md` y cargarlas en Play Console, nunca en GitHub.

## Flujo recomendado

1. Iniciar sesión como pasajero.
2. Confirmar origen manual o GPS y destino.
3. Solicitar viaje de prueba.
4. Iniciar sesión en otro dispositivo como conductor.
5. Aceptar, marcar llegada, iniciar y completar.
6. Verificar historial, beneficio de efectivo y pago con tarjeta según la cuenta QA.
7. Revisar Perfil > Solicitud de eliminación de cuenta.

## Ubicación

La ubicación previa se conserva de forma temporal. El seguimiento operativo comienza durante el flujo del viaje y se detiene al finalizar o cancelar. Para una prueba fuera de Rapa Nui, usar coordenadas simuladas únicamente en el entorno QA autorizado e indicarlo al revisor.

## Funciones no incluidas

Turismo local, guías, arriendo de vehículos y eventos no forman parte de esta versión y se muestran únicamente como módulos deshabilitados y no son accesibles mediante rutas directas.

## URLs

- Privacidad: `https://api.rapago.cl/privacidad`
- Términos: `https://api.rapago.cl/terminos`
- Soporte: `https://api.rapago.cl/soporte`
- Eliminación: `https://api.rapago.cl/eliminar-cuenta`
