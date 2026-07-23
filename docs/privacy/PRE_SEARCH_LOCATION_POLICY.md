# Política técnica de ubicación previa a la búsqueda

## Alcance

Esta política regula la ubicación obtenida antes de crear una solicitud de viaje. No modifica el seguimiento del conductor durante un viaje aceptado o en curso.

## Reglas implementadas

1. La aplicación solicita ubicación únicamente cuando el pasajero utiliza una función que la necesita para definir el origen o solicitar un viaje.
2. La captura previa se conserva solo en `sessionStorage` bajo la clave `rapago_pre_search_location_v1`.
3. La captura tiene una vigencia máxima de 15 minutos.
4. La captura se elimina al crear correctamente la solicitud, abandonar la pantalla o vencer su vigencia.
5. La captura previa no se guarda en `localStorage` ni se trata como historial permanente.
6. El backend recibe las coordenadas confirmadas de origen y destino cuando el usuario crea la solicitud. No recibe un flujo continuo de ubicación antes de esa acción.
7. Las observaciones del viaje no deben contener una copia textual de las coordenadas GPS exactas.
8. La denegación del permiso debe producir un mensaje comprensible y permitir que el usuario seleccione o escriba un origen alternativo cuando el flujo lo admita.

## Separación de finalidades

- **Antes de solicitar:** ayudar al pasajero a definir el punto de recogida.
- **Durante búsqueda/asignación:** utilizar el origen confirmado de la solicitud para encontrar conductor.
- **Durante viaje:** seguimiento operacional conforme al estado del viaje y a los permisos concedidos.
- **Después de finalizar o cancelar:** detener el seguimiento operacional y conservar únicamente el registro de viaje necesario.

## Evidencia técnica

- Servicio efímero: `apps/mobile/src/features/location/preSearchLocation.service.ts`.
- Integración: `apps/mobile/src/pages/passenger/pages/RequestRidePage.tsx`.
- Limpieza automática por desmontaje, creación correcta y expiración.

**Estado del punto 19:** completado técnicamente.
