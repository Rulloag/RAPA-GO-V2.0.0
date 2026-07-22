# Guía de Demo — MVP Movilidad RAPA GO

**Versión:** 2.0.0
**Fecha:** 2026-06-01
**Estado:** MVP cerrado · 36/36 tests · 0 errores TypeScript

---

## 1. Objetivo de la demo

Demostrar el flujo operativo completo del MVP de movilidad de RAPA GO, desde la solicitud del pasajero hasta las ganancias del conductor, usando despacho manual por administrador.

Se mostrará:
- **Solicitud de viaje** con selección de origen/destino via Google Maps, cálculo de ruta, distancia, duración y tarifa en tiempo real
- **Despacho manual** por administrador: asignación de conductor disponible a la solicitud
- **Ejecución por conductor**: compartir ubicación GPS, avanzar estados del viaje
- **Seguimiento visual del pasajero**: ver ubicación del conductor y ruta en mapa según estado
- **Ganancias del conductor**: tarjeta con bruto, comisión app 20% y ganancia neta del día

---

## 2. Requisitos previos

Antes de iniciar la demo, verificar:

- [ ] Backend corriendo (`npm run dev:api`)
- [ ] Mobile corriendo (`npm run dev:mobile`)
- [ ] Base de datos conectada y accesible
- [ ] Google Maps API key configurada con las APIs: Maps JavaScript API, Places API, Directions API
- [ ] Migraciones de DB aplicadas
- [ ] Usuarios demo creados (seed)

---

## 3. Variables de entorno necesarias

```env
# apps/api/.env
DATABASE_URL=postgresql://user:password@localhost:5432/rapago
JWT_SECRET=your-secret-here

# apps/mobile/.env
VITE_API_BASE_URL=/api
VITE_GOOGLE_MAPS_API_KEY=your-key-here    # No commitear
```

---

## 4. Comandos para levantar el entorno

```bash
# Instalar dependencias
npm install
npm install --workspace=apps/api

# Aplicar migraciones
npm run db:migrate --workspace=apps/api

# Crear usuarios demo
npm run seed:dev --workspace=apps/api

# Levantar (en dos terminales separadas)
npm run dev:api
npm run dev:mobile
```

---

## 5. Credenciales demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Pasajero | passenger@rapago.local | Test1234! |
| Admin | admin@rapago.local | Test1234! |
| Conductor | driver@rapago.local | Test1234! |

---

## 6. Orden recomendado de ventanas

Para una demo limpia sin mezclar sesiones, usar **navegadores distintos o ventanas incógnito separadas**:

| Ventana | Rol | Sesión sugerida |
|---------|-----|----------------|
| Ventana 1 | Pasajero | Chrome normal |
| Ventana 2 | Admin | Firefox |
| Ventana 3 | Conductor | Chrome Incógnito |

> Alternativa en móvil real: dispositivos separados o perfiles de navegador distintos.

---

## 7. Guion de demo paso a paso

### Paso 1 — Pasajero solicita viaje

1. **Login** con `passenger@rapago.local / Test1234!`
2. Ir a la pestaña **"Solicitar Viaje"**
3. Escribir o seleccionar el **origen** con el buscador de Google Places
4. Escribir o seleccionar el **destino**
5. Confirmar que el mapa muestra:
   - Ruta trazada (línea azul)
   - Distancia en km
   - Duración estimada
   - Tarifa calculada en CLP
6. Pulsar **"Solicitar viaje"**
7. Ir a la pestaña **"Mis Viajes"**
8. Mostrar el viaje en estado **"Esperando conductor"** con spinner de asignación pendiente

---

### Paso 2 — Admin asigna conductor

1. **Login** con `admin@rapago.local / Test1234!`
2. Ir al panel **Admin → Viajes**
3. Ver la solicitud recién creada en estado `requested`
4. Ir a **Admin → Conductores** (o sección de disponibilidad)
5. Confirmar que el conductor aparece como **disponible**
6. Asignar el conductor al viaje
7. Confirmar que el viaje cambia a estado **`accepted`**

---

### Paso 3 — Conductor recibe el viaje

1. **Login** con `driver@rapago.local / Test1234!`
2. Ir a **"Mis Viajes"**
3. Ver el viaje asignado con estado **"Aceptado"**
4. Pulsar **"📍 Mi ubicación"** para compartir la posición GPS actual
5. Confirmar mensaje de éxito con hora de actualización
6. Mostrar que el mapa de la tarjeta muestra la ruta hacia el origen del pasajero

---

### Paso 4 — Pasajero ve la ubicación del conductor

1. Volver a la ventana del **Pasajero**
2. Ir a **"Mis Viajes"** y pulsar **"Actualizar"** en el toolbar
3. En la tarjeta del viaje activo, expandir la sección **"Ubicación del conductor"**
4. Pulsar **"Actualizar"** dentro de esa sección
5. Mostrar:
   - Marcador del conductor en el mapa
   - Ruta trazada desde el conductor hacia el origen (punto verde)
   - Distancia y duración de la ruta
   - Hora de última actualización del conductor

---

### Paso 5 — Conductor avanza los estados del viaje

En la ventana del **Conductor**, desde "Mis Viajes":

| Acción | Estado resultante |
|--------|-----------------|
| Pulsar **"Voy en camino"** | `driver_en_route` |
| Pulsar **"Llegué"** | `driver_arrived` |
| Pulsar **"Iniciar viaje"** | `in_progress` |
| Pulsar **"Finalizar"** | `completed` |

> Entre cada acción, el conductor puede volver a pulsar **"📍 Mi ubicación"** para actualizar su posición.

---

### Paso 6 — Pasajero ve el avance del estado

En la ventana del **Pasajero**, pulsar **"Actualizar"** en cada estado para mostrar:

| Estado conductor | Label que ve el pasajero |
|-----------------|--------------------------|
| `driver_en_route` | "Tu conductor va en camino" |
| `driver_arrived` | "Tu conductor llegó" |
| `in_progress` | "Viaje en curso" |
| `completed` | "Viaje completado" |

Mostrar también la **línea de tiempo del viaje** (TripTimeline) con cada hito y su hora.

---

### Paso 7 — Conductor ve sus ganancias del día

1. Volver a la ventana del **Conductor**
2. Ir al **tab Home** del conductor
3. Mostrar la tarjeta **"Ganancias de hoy"** que se actualiza automáticamente al volver al Home:
   - Viajes completados hoy
   - Total bruto acumulado
   - Comisión app (20%)
   - **Ganancia neta (80%)**
4. Pulsar la tarjeta para ir a la página completa de **Ganancias**

---

## 8. Qué decir durante la demo

> Frases sugeridas para presentar a Rodrigo, Manuel o al equipo:

- *"Este MVP usa despacho manual por administrador. El admin ve las solicitudes en tiempo real y asigna al conductor disponible. El objetivo es validar el flujo operativo antes de automatizar la asignación."*

- *"El tracking de ubicación es manual por ahora: el conductor pulsa un botón para compartir su posición. En la siguiente fase se implementará tracking automático en segundo plano."*

- *"La comisión del 20% es informativa para este MVP. Los montos son referenciales y no corresponden a liquidación real ni a pago efectivo al conductor."*

- *"No hemos integrado pagos reales ni wallet. El flujo de cobro se diseñará en una fase posterior, una vez validado que el flujo operativo funciona correctamente."*

- *"El objetivo de este piloto es validar que el flujo completo —desde la solicitud hasta el viaje completado— funciona de forma confiable antes de añadir automatización y pagos."*

---

## 9. Qué NO mostrar como terminado

Las siguientes funcionalidades están pendientes para fases posteriores:

| Funcionalidad | Estado |
|---------------|--------|
| WebSocket / realtime | ❌ No implementado — requiere actualización manual |
| Tracking GPS automático en segundo plano | ❌ No implementado — es manual |
| Notificaciones push | ❌ No implementado |
| Pagos reales / cobro al pasajero | ❌ No implementado |
| Wallet / saldo conductor-pasajero | ❌ No implementado |
| Liquidaciones reales al conductor | ❌ No implementado — monto es referencial |
| Navegación turn-by-turn | ❌ No implementado — solo ruta visual |
| Validación server-side con Google Routes API | ❌ Distancia viene del cliente |
| Módulo Turismo (Rentals / Guides) | ⏳ Pendiente |
| Asignación automática de conductor | ⏳ Pendiente |

---

## 10. Checklist de validación rápida antes de la demo

Ejecutar este checklist en el entorno de demo **antes de recibir a los asistentes**:

- [ ] Login pasajero OK (passenger@rapago.local)
- [ ] Google Maps carga correctamente en RequestRidePage
- [ ] Autocomplete de lugares funciona (origen y destino)
- [ ] Solicitud de viaje creada OK (aparece en "Mis Viajes")
- [ ] Login admin OK (admin@rapago.local)
- [ ] Viaje `requested` aparece en dashboard admin
- [ ] Conductor disponible visible en panel admin
- [ ] Admin asigna conductor → viaje queda `accepted`
- [ ] Login conductor OK (driver@rapago.local)
- [ ] Viaje asignado visible en "Mis Viajes" del conductor
- [ ] Ubicación GPS compartida OK (botón "📍 Mi ubicación")
- [ ] Pasajero ve ubicación del conductor y ruta en mapa
- [ ] Estado `driver_en_route` avanza OK
- [ ] Estado `driver_arrived` avanza OK
- [ ] Estado `in_progress` avanza OK
- [ ] Estado `completed` avanza OK
- [ ] Conductor queda `available` después de completar
- [ ] Tarjeta "Ganancias de hoy" se actualiza al volver al Home
- [ ] Pasajero ve viaje como `completed` y puede calificar

---

## 11. Posibles errores y solución rápida

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| Login falla / "User not found" | Seed no ejecutado o DB no conectada | Correr `npm run seed:dev --workspace=apps/api` y verificar `DATABASE_URL` |
| Google Maps no carga / pantalla gris | API key inválida o APIs no habilitadas | Verificar `VITE_GOOGLE_MAPS_API_KEY` en `.env`; habilitar Maps JS API, Places API y Directions API en Google Cloud Console |
| Autocomplete no devuelve resultados | Places API no habilitada o quota agotada | Verificar la API en Google Cloud Console |
| Admin no puede asignar conductor | Conductor en estado `unavailable` o `busy` | El conductor debe estar en `available`; verificar toggle de disponibilidad |
| Pasajero no ve ruta del conductor | Conductor no compartió ubicación o campos geo nulos | Conductor debe pulsar "📍 Mi ubicación"; verificar que el viaje tenga `originLat/Lng` |
| Ganancias no aparecen en Home conductor | Conductor no tiene viajes completados hoy (UTC) | Completar al menos un viaje y volver al tab Home |
| Error 401 en cualquier request | Token expirado | Cerrar sesión y volver a hacer login |
| Error 409 al avanzar estado | Intento de avanzar estado fuera de secuencia | Respetar el orden: accepted → driver_en_route → driver_arrived → in_progress → completed |

---

## 12. Próximos pasos recomendados

| Prioridad | Paso | Descripción |
|-----------|------|-------------|
| 1 | **Demo interna** | Ejecutar la demo con Rodrigo / Manuel usando esta guía |
| 2 | **Ajustes UX menores** | Incorporar feedback de la demo |
| 3 | **Despliegue staging** | Configurar entorno de staging (VPS o Render/Railway) |
| 4 | **Notificaciones push** | Avisar al pasajero cuando el conductor avanza estados |
| 5 | **Tracking automático** | Background geolocation + polling o WebSocket |
| 6 | **Pagos / wallet** | Integrar pasarela de cobro y liquidación al conductor |
| 7 | **Turismo / Rentals / Guides** | Módulos complementarios ya con pantallas placeholder |
| 8 | **Asignación automática** | Algoritmo de matching conductor-pasajero sin intervención admin |
