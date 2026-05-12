# Arquitectura de Mapas — RAPA GO V2.0.0

## Proveedor

**Google Maps SDK/API** es el único proveedor de mapas autorizado para RAPA GO V2.0.0.

## Componentes utilizados

| Componente | Uso |
|-----------|-----|
| Maps JavaScript API | Renderizado de mapa en WebView (Ionic/Capacitor) |
| Directions API | Cálculo de rutas (pasajero → conductor, origen → destino) |
| Geocoding API | Conversión de coordenadas a direcciones legibles |
| Places API | Búsqueda de destinos y lugares en Rapa Nui |
| Distance Matrix API | Estimación de tiempo y distancia para tarificación |

## API Key

- La API Key de Google Maps reside en el **backend** para llamadas server-side (Directions, Distance Matrix, Geocoding, Places).
- Para el renderizado del mapa en el cliente (Maps SDK), se usa una API Key restringida por bundleId/packageName de la app, configurada en Google Cloud Console.
- La API Key del cliente está restringida al dominio/app de RAPA GO. Nunca se usa una key irrestricta en producción.

## Flujo de uso del mapa en viajes

```
1. Pasajero abre app → mapa centrado en su ubicación actual (Geolocation API)

2. Pasajero selecciona destino → Places API para autocompletado

3. Pasajero confirma solicitud → backend recibe origen + destino

4. Backend consulta Distance Matrix API → estima precio y tiempo

5. Conductor acepta → backend consulta Directions API → devuelve ruta al cliente

6. Durante el viaje → posición del conductor se actualiza via Realtime
   → cliente anima el pin del conductor en el mapa
```

## Consideraciones para Rapa Nui

- Google Maps tiene cobertura de Rapa Nui, pero con datos menos detallados que zonas urbanas de Chile continental.
- Se deben probar las APIs de Places y Directions específicamente para la isla antes de go-live.
- Los nombres de lugares en Rapa Nui (idioma rapanui) pueden no estar en el catálogo de Places API. Se puede complementar con un catálogo propio de lugares de interés.

## Geolocalización en el cliente

- Se usa `@capacitor/geolocation` para obtener la posición GPS del dispositivo.
- Se solicitan permisos explícitos al usuario según plataforma (Android/iOS).
- El conductor solo comparte su ubicación cuando tiene un viaje activo.
- El cliente no almacena el historial de ubicación; lo envía al backend.

## Tarificación basada en distancia

El backend usa Distance Matrix API para calcular:
- Distancia en km entre origen y destino.
- Tiempo estimado de viaje.
- Precio estimado según tabla de tarifas del operador.

La tarifa final se confirma al completar el viaje con la distancia real recorrida.

## Costos de API

Google Maps API cobra por llamada. Para optimizar costos:
- Geocoding y Distance Matrix se llaman server-side (mayor control).
- No hacer llamadas redundantes: cachear resultados de Directions para rutas repetidas.
- La visualización del mapa en el cliente usa el SDK gratuito hasta el límite mensual.
- Monitorear uso en Google Cloud Console desde el inicio.
