# Arquitectura Mobile — RAPA GO V2.0.0

## Stack

| Tecnología | Versión objetivo | Rol |
|-----------|-----------------|-----|
| Ionic React | 8.x | Framework de componentes UI mobile |
| Capacitor | 6.x | Bridge nativo Android/iOS |
| TypeScript | 5.x | Tipado estático |
| React | 18.x | Motor de renderizado |
| React Router | 6.x | Navegación entre pantallas |
| Zod | 3.x | Validación de esquemas y formularios |

## Estructura de carpetas (target)

```
mobile/
├── src/
│   ├── pages/           — Pantallas principales (una por ruta)
│   ├── components/      — Componentes reutilizables
│   ├── hooks/           — Custom hooks (useTrip, useWallet, useAuth...)
│   ├── services/        — Llamadas al backend (apiClient, supabaseClient)
│   ├── store/           — Estado global (React Context o Zustand)
│   ├── schemas/         — Esquemas Zod compartidos con backend
│   ├── types/           — Tipos TypeScript del dominio
│   └── utils/           — Helpers sin efectos secundarios
├── capacitor.config.ts
└── ionic.config.json
```

## Principios de la capa mobile

### Pantallas
Cada pantalla (`/pages`) debe implementar:
- Ruta definida en el router.
- Estado de carga (`isLoading`).
- Estado de error (`error`) con mensaje visible al usuario.
- Datos reales provenientes de un servicio (nunca hardcodeados).
- Validación con Zod si captura input del usuario.

### Servicios
La capa `/services` es el único lugar donde se hacen llamadas HTTP o suscripciones al backend. Las pantallas no llaman directamente a `fetch`.

### Estado global
El estado global (sesión del usuario, perfil) se gestiona mediante Context o Zustand. El estado de viajes activos, wallet y matching se solicita al backend en cada montaje o se actualiza via suscripción Realtime. No se almacena en `localStorage`.

### Navegación
- Rutas públicas: login, registro, onboarding.
- Rutas protegidas: requieren token válido verificado. El guard de ruta consulta el estado de sesión, no `localStorage`.
- Rutas de rol: conductor, guía, admin tienen secciones separadas.

## Capacitor — plugins requeridos

| Plugin | Propósito |
|--------|-----------|
| `@capacitor/geolocation` | Ubicación del conductor/pasajero |
| `@capacitor/push-notifications` | Notificaciones push |
| `@capacitor/camera` | Subida de documentos/fotos de perfil |
| `@capacitor/network` | Detección de conectividad |
| `@capacitor/storage` | Preferencias no críticas (tema, idioma) |
| `RapaGoBackgroundLocation` | Plugin propio: seguimiento GPS en segundo plano (ver abajo) |

## Seguimiento de ubicación en segundo plano

Mientras el conductor tiene la app en pantalla, el WebView lee el GPS sin problema. Al
minimizar la app o bloquear la pantalla, el sistema congela ese WebView y el GPS deja de
reportar: el pasajero vería el auto detenido aunque el conductor avance. Por eso el
seguimiento vive en código nativo — foreground service en Android, `UIBackgroundModes:
location` en iOS — mediante el plugin propio `RapaGoBackgroundLocation`.

Solo se rastrea con un viaje activo. Ver `docs/store/BACKGROUND_LOCATION_JUSTIFICATION.md`.

### Dueño único

`features/location/rideTrackingCoordinator.ts` es el **único** que arranca y detiene el
seguimiento. Es un **módulo, no un hook**, y esa decisión es deliberada: un módulo no
tiene `unmount`, así que ningún componente puede matarlo al desmontarse.

Mantiene un *estado deseado* (`setDesired({rideId, accessToken, permissions} | null)`) y lo
reconcilia contra el *estado real*, que obtiene preguntando al nativo con `getState()` —
nunca deduciéndolo de una variable en memoria. Si algo externo mató el servicio, la
siguiente reconciliación lo detecta y lo revive. Reconcilia ante: cambio de `desired`,
`App.appStateChange`, `Network.networkStatusChange` y un intervalo de 15 s.

El coordinador arbitra quién publica: el servicio nativo cuando puede, y la capa JS cuando
no (web, iOS sin `.authorizedAlways`, Android sin `ACCESS_BACKGROUND_LOCATION`).

`singleOwner.arch.test.ts` falla en CI si el ciclo de vida del GPS reaparece dentro de
`pages/driver/index.tsx`, que es donde estaba el bug original.

### Cola offline (dos niveles)

Sin señal los puntos no se pierden: se encolan y se reenvían por lotes al recuperar red.
Hace falta en **ambos lados** porque los puntos de segundo plano los produce Java/Swift,
que no ve el `localStorage` del WebView:

| Capa | Almacén | Tope |
|------|---------|------|
| Android (`RapaGoLocationQueue.java`) | `SharedPreferences` | 1000 puntos |
| iOS (`RapaGoLocationQueue.swift`) | `UserDefaults` | 1000 puntos |
| JS (`locationQueue.ts`) | `@capacitor/preferences` (respaldo `localStorage`) | 500 puntos |

La lista en memoria es la fuente de verdad y se vuelca a disco como mucho cada 15 s:
persistir en cada punto reescribiría cientos de KB cada pocos segundos sin ganar nada.
Al llenarse se descartan los **más antiguos**. Los duplicados entre colas son inofensivos
gracias al índice único de la tabla.

**Privacidad:** la cola es historial de ubicación precisa en disco. Se vacía al terminar el
viaje, al cerrar sesión (`clientStoragePolicy`) y ante `AUTH_SESSION_REVOKED` /
`AUTH_ACCOUNT_DELETED`.

### Endpoint de lote

`POST /api/rides/:id/location/batch`, máximo 200 puntos por llamada.

El antispam del punto en vivo compara contra el último punto guardado; aplicado a un
histórico descartaría el lote entero. El backend usa en su lugar un **cursor que avanza
dentro del lote**: cada punto se compara con el anterior aceptado del propio lote. Acepta
además puntos de viajes ya `completed`/`cancelled` dentro de la ventana del viaje, porque
un backlog casi siempre contiene los últimos minutos —los que importan en una disputa de
tarifa—. Responde **200 incluso con puntos rechazados**: el éxito parcial es de diseño.

**Regla del cliente:** cualquier **2xx drena** los puntos enviados de la cola, y también
400/403/404/409. **No** se drena en 401/429/5xx/red. Sin esta regla, un punto
permanentemente rechazable bloquearía la cabeza de la cola para siempre.

### Renovación del token

El nativo recibe una copia del `accessToken`; al expirar, antes se auto-detenía para
siempre. Ahora el coordinador le empuja el token nuevo con `updateAccessToken()` cada vez
que cambia — `AuthProvider` ya lo renueva por temporizador, al recuperar foco y al volver
la red, así que el nativo casi nunca llega a ver un 401.

Como red de seguridad, el nativo distingue por el **`code` del envelope**, no por el status
HTTP:

| Respuesta | Acción |
|-----------|--------|
| 401 `AUTH_TOKEN_EXPIRED` | **Pausa la entrega** (`authPaused`), sigue capturando y encolando |
| 401 otros (`AUTH_SESSION_REVOKED`, `AUTH_ACCOUNT_DELETED`) | Detiene y **vacía la cola** |
| 403 `RIDE_TRACKING_NOT_ASSIGNED` / 409 `RIDE_TRACKING_INACTIVE` | Detiene y vacía |
| 400 / 404 | Descarta ese lote y sigue |
| 429 / 5xx / red | Conserva y reintenta con backoff 5→10→30→60 s |

El refresh token **nunca** se le entrega al nativo: metería una credencial de larga vida en
almacenamiento nativo y duplicaría la máquina de estados de `AuthProvider`.

### Supervivencia y calidad del fix (Android)

El servicio devuelve `START_STICKY`: si Android lo mata por presión de memoria, el sistema
lo revive. Eso **exige** haber guardado antes la configuración en `SharedPreferences`,
porque en el reinicio Android entrega `intent == null` y hay que llamar a
`startForeground()` igualmente o la app muere con
`ForegroundServiceDidNotStartInTimeException`.

El **token no se guarda**: es una credencial y al revivir estaría vencida de todos modos.
El servicio reanuda marcado como `authPaused` — captura y encola sin entregar — y recibe
uno fresco vía `updateAccessToken()` cuando la app se reabre. La configuración se descarta
si tiene más de 6 h, para que un servicio revivido no capture GPS indefinidamente si el
usuario nunca vuelve a abrir la app. `stopTracking()` la borra: una parada deliberada no
debe poder revivir.

Se escuchan `GPS_PROVIDER` y `NETWORK_PROVIDER` en paralelo y Android **no los fusiona**,
así que llegan intercalados con precisiones muy distintas. Antes de encolar se descarta:
todo fix anterior al último aceptado (rompería el orden que usa el cursor del backend), y
todo fix peor de 100 m si el anterior aceptado era mejor de 50 m y tiene menos de 20 s —
sin eso, un fix de red de 2 km teletransporta el marcador del pasajero y vuelve.

### Degradación de permisos (iOS)

`locationManagerDidChangeAuthorization` detecta que el usuario bajó de "Siempre" a
"Mientras se usa" desde Ajustes durante el viaje: antes eso dejaba el seguimiento muerto en
silencio. Ahora se detiene limpiamente y se avisa, para que el coordinador pase a publicar
desde la capa JS. `didFailWithError` con `kCLErrorDenied` también detiene, en vez de
limitarse a guardar el error.

### Puente local de compatibilidad

`rapago_driver_live_locations_v1` (mapa indexado por `rideId`) y
`rapago_current_driver_location` (hueco único) alimentan el mapa en el mismo dispositivo.
El coordinador **fusiona** sobre lo guardado en vez de reemplazarlo, para no borrar los
datos de identidad del vehículo que escribe la página del conductor.

`PassengerLocationRuntime` escribe solo el mapa por viaje, nunca el hueco único: ese
runtime también corre para usuarios con rol `driver`, y la semilla del mapa del conductor
aplica esa clave sin comprobar el `rideId`.

## Reglas de uso de almacenamiento local

| Dato | Permitido en localStorage/Capacitor Storage | Razón |
|------|---------------------------------------------|-------|
| Tema UI (claro/oscuro) | Sí | Preferencia visual |
| Idioma seleccionado | Sí | Preferencia UI |
| Token de sesión | No | Crítico — gestionado por Supabase Auth |
| Saldo wallet | No | Crítico — fuente de verdad en backend |
| Estado de viaje | No | Crítico — fuente de verdad en backend |
| Datos de pago | No | Crítico — solo backend |

## Manejo de errores en UI

Todo componente que consume datos del backend debe manejar:
1. `loading`: mostrar skeleton o spinner.
2. `error`: mostrar mensaje de error legible y opción de reintentar.
3. `empty`: estado vacío cuando no hay datos.
4. `success`: renderizado normal de datos.

## Consideraciones de conectividad

Rapa Nui puede tener conectividad móvil intermitente. La app debe:
- Detectar estado offline via `@capacitor/network`.
- Bloquear acciones críticas (pagos, iniciar viaje) sin conexión.
- Mostrar banner de estado offline visible.
- No cachear datos críticos localmente como solución permanente.
