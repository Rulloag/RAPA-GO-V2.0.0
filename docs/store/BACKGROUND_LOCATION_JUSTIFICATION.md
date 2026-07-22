# RAPA GO — Justificación de ubicación en segundo plano

## Función principal

RAPA GO usa la ubicación en segundo plano exclusivamente para un conductor que ya aceptó un viaje y debe mantener su posición visible para el pasajero y el operador mientras navega, incluso si la aplicación queda minimizada o la pantalla se bloquea.

## Momento en que se solicita

1. Primero se solicita ubicación precisa mientras se usa la aplicación.
2. Solo cuando existe un viaje activo se explica la necesidad operacional.
3. Después de esa explicación se ofrece solicitar “Permitir siempre” o abrir la configuración del sistema, según la versión del dispositivo.
4. Negar el permiso no impide iniciar sesión ni usar áreas que no requieren seguimiento; sí puede limitar la ejecución de un viaje como conductor.

## Inicio y detención

El seguimiento comienza únicamente para estados operacionales activos: conductor asignado, en camino, llegó o viaje iniciado. Se detiene al completar o cancelar el viaje, cerrar sesión, perder autorización o recibir una respuesta del servidor que indique que el viaje ya no puede ser seguido.

## Transparencia

Android mantiene una notificación persistente mientras el servicio de ubicación está activo. iOS muestra el indicador de ubicación en segundo plano. La Política de Privacidad explica finalidad, duración y forma de retirar el permiso.

## Datos enviados

- Identificador del viaje y del conductor autenticado.
- Latitud y longitud.
- Precisión, rumbo, velocidad y altitud cuando estén disponibles.
- Fecha y hora de captura.
- Estado de la aplicación y fuente de la medición.
- Indicador de ubicación simulada cuando el sistema operativo lo informa.

Los puntos se conservan durante un plazo limitado para operación, seguridad, reclamos y reconstrucción de la ruta, y luego expiran conforme a la política de conservación.

## Material recomendado para revisión de tiendas

Grabar un video corto que muestre: conductor acepta un viaje, pantalla explicativa, concesión del permiso, notificación persistente, aplicación minimizada, movimiento del conductor reflejado para el pasajero y detención automática al finalizar el viaje.
