# MVP Movilidad — Estado Técnico

**Fecha:** 2026-06-01
**Resultado QA Parte 8:** Aprobado con observaciones
**Tests:** 36/36 passing · TypeScript: 0 errores · Build: OK

---

## Flujo completo implementado

| Paso | Actor | Acción |
|------|-------|--------|
| 1 | Pasajero | Selecciona origen y destino con Google Maps Autocomplete |
| 2 | Backend | Calcula tarifa por distancia: `max(2 300 CLP/km, 3 000 CLP mínimo)` |
| 3 | Pasajero | Confirma origen, destino, ruta, distancia, duración y tarifa |
| 4 | Admin | Ve el viaje en estado `requested` en su dashboard |
| 5 | Admin | Selecciona conductor disponible y asigna el viaje |
| 6 | Backend | El viaje pasa a `accepted`; el conductor queda `busy` |
| 7 | Conductor | Ve el viaje asignado en "Mis Viajes" |
| 8 | Conductor | Comparte su ubicación GPS manualmente (botón "📍 Mi ubicación") |
| 9 | Pasajero | Ve ubicación del conductor y ruta visual en el mapa |
| 10 | Conductor | Avanza el viaje por 4 transiciones de estado |
| 11 | Pasajero | Ve actualización de estado al presionar "Actualizar" |
| 12 | Conductor | Al completar, queda `available` y puede aceptar nuevos viajes |
| 13 | Conductor | Ve ganancias del día: bruto, comisión 20%, neto 80% |
| 14 | Pasajero | Puede calificar al conductor con estrellas y comentario |

---

## Estados de viaje

### `requested`
- **Generado por:** pasajero al confirmar solicitud
- **Pasajero ve:** "Esperando conductor" + spinner de asignación pendiente
- **Conductor ve:** —
- **Habilita:** admin puede asignar conductor; pasajero puede cancelar

### `accepted`
- **Generado por:** admin al asignar conductor
- **Pasajero ve:** "Conductor asignado" + info del conductor (nombre, vehículo, teléfono)
- **Conductor ve:** viaje en "Mis Viajes"; puede compartir ubicación
- **Habilita:** conductor puede pulsar "Voy en camino" o cancelar; pasajero puede cancelar

### `driver_en_route`
- **Generado por:** conductor → botón "Voy en camino"
- **Pasajero ve:** "Tu conductor va en camino" + mapa con ruta conductor→origen
- **Conductor ve:** ruta hacia el origen del pasajero (si compartió ubicación)
- **Habilita:** conductor puede pulsar "Llegué"

### `driver_arrived`
- **Generado por:** conductor → botón "Llegué"
- **Pasajero ve:** "Tu conductor llegó" + mensaje de llegada en mapa
- **Conductor ve:** mensaje "Ya llegaste al punto de recogida"
- **Habilita:** conductor puede pulsar "Iniciar viaje"

### `in_progress`
- **Generado por:** conductor → botón "Iniciar viaje"
- **Pasajero ve:** "Viaje en curso" + mapa con ruta conductor→destino
- **Conductor ve:** ruta hacia el destino (si compartió ubicación)
- **Habilita:** conductor puede pulsar "Finalizar"

### `completed`
- **Generado por:** conductor → botón "Finalizar"
- **Pasajero ve:** "Viaje completado" + botón para calificar conductor
- **Conductor ve:** viaje en historial; ganancias del día se actualizan
- **Habilita:** pasajero puede calificar; conductor queda disponible

### `cancelled`
- **Generado por:** pasajero (desde `requested` o `accepted`) o conductor (desde `accepted`)
- **Pasajero ve:** "Viaje cancelado" + motivo y quién canceló
- **Conductor ve:** viaje cancelado en historial; queda disponible automáticamente
- **Habilita:** —

---

## Endpoints clave

| Método | Ruta | Actor | Descripción |
|--------|------|-------|-------------|
| `POST` | `/api/rides/request` | Pasajero | Crear solicitud. Body: `originText`, `destinationText`, `originLat/Lng`, `destinationLat/Lng`, `distanceMeters`, `durationSeconds` |
| `GET`  | `/api/rides/me` | Pasajero | Lista todos los viajes del pasajero con info del conductor |
| `GET`  | `/api/rides/driver/me` | Conductor | Lista todos los viajes asignados al conductor |
| `POST` | `/api/admin/rides/:id/assign` | Admin | Asigna conductor. Body: `{ driverUserId }` |
| `POST` | `/api/rides/:id/en-route` | Conductor | Avanza a `driver_en_route` |
| `POST` | `/api/rides/:id/arrived` | Conductor | Avanza a `driver_arrived` |
| `POST` | `/api/rides/:id/start` | Conductor | Avanza a `in_progress` |
| `POST` | `/api/rides/:id/complete` | Conductor | Avanza a `completed`; libera al conductor |
| `PATCH`| `/api/drivers/me/location` | Conductor | Comparte GPS. Body: `{ lat, lng }` |
| `GET`  | `/api/rides/:id/driver-location` | Pasajero | Última ubicación compartida del conductor |
| `GET`  | `/api/drivers/me/earnings/today` | Conductor | Ganancias del día UTC actual |

---

## Cálculo de tarifa y ganancias

**Tarifa:**
```
fareClp = max( distanceMeters / 1000 * 2300, 3000 )
```

**Comisión:**
```
grossFareClp       = sum(estimatedFareClp de viajes completados hoy UTC)
appCommissionClp   = Math.round(grossFareClp * 0.20)
netEarningsClp     = grossFareClp - appCommissionClp
```

> Los montos son referenciales para MVP. No corresponden a liquidación ni pago real.

---

## Variables de entorno requeridas

```env
# apps/api/.env
DATABASE_URL=postgresql://user:password@localhost:5432/rapago
JWT_SECRET=your-secret-here

# apps/mobile/.env
VITE_API_BASE_URL=/api
VITE_GOOGLE_MAPS_API_KEY=your-key-here   # NO commitear
```

---

## Credenciales demo (entorno local)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Pasajero | passenger@rapago.local | Test1234! |
| Admin | admin@rapago.local | Test1234! |
| Conductor | driver@rapago.local | Test1234! |

---

## Comandos

```bash
# Levantar
npm run dev:api
npm run dev:mobile

# Validar
npm run test --workspace=apps/api
npm run typecheck --workspace=apps/api
npm run build --workspace=apps/api
npm run typecheck --workspace=apps/mobile
npm run build --workspace=apps/mobile
```

---

## Checklist de demo manual

- [ ] Login pasajero (`passenger@rapago.local`)
- [ ] Crear viaje: seleccionar origen y destino con Google Maps
- [ ] Confirmar tarifa calculada, distancia y duración
- [ ] Login admin (`admin@rapago.local`)
- [ ] Verificar que el viaje aparece en estado `requested`
- [ ] Verificar que el conductor aparece como disponible
- [ ] Asignar conductor al viaje
- [ ] Verificar que el viaje queda en `accepted`
- [ ] Login conductor (`driver@rapago.local`)
- [ ] Verificar que el viaje aparece en "Mis Viajes"
- [ ] Pulsar "📍 Mi ubicación" (compartir GPS)
- [ ] Pulsar "Voy en camino" → estado `driver_en_route`
- [ ] Login pasajero → "Actualizar" → ver estado `driver_en_route` y ruta
- [ ] Login conductor → Pulsar "Llegué" → estado `driver_arrived`
- [ ] Pulsar "Iniciar viaje" → estado `in_progress`
- [ ] Login pasajero → "Actualizar" → ver ruta hacia destino
- [ ] Login conductor → Pulsar "Finalizar" → estado `completed`
- [ ] Verificar que conductor queda `available` (toggle en home)
- [ ] Verificar ganancias del día actualizadas en "Ganancias"
- [ ] Login pasajero → ver viaje como `completed`
- [ ] Calificar conductor con estrellas

---

## Observaciones pendientes

| # | Severidad | Descripción | Acción recomendada |
|---|-----------|-------------|-------------------|
| 1 | Baja | Ganancias en `DriverHomePage` no se refrescan automáticamente al completar un viaje desde la misma pantalla. El conductor debe navegar a la página de Ganancias o salir y volver al Home. | Agregar refresh de earnings después de `handleComplete` en Parte siguiente |
| 2 | Baja | El botón "Calificar" aparece inmediatamente al completar un viaje sin ventana de espera. | Aceptado como diseño MVP |

---

## No incluido en este MVP

Las siguientes funcionalidades están explícitamente excluidas y deben implementarse en fases posteriores:

- **Tracking automático en background** — el conductor debe compartir ubicación manualmente cada vez
- **WebSocket / realtime** — el pasajero debe presionar "Actualizar" para ver cambios de estado
- **Notificaciones push** — no hay avisos automáticos al cambiar de estado
- **Pagos reales** — la tarifa es referencial; no hay cobro ni transferencia
- **Wallet / saldo** — módulo no implementado
- **Liquidaciones reales** — las ganancias son informativas, no generan pago al conductor
- **Navegación turn-by-turn** — el mapa muestra la ruta pero no da instrucciones de giro
- **Validación Google Routes API server-side** — la distancia/duración viene del cliente (Google Maps SDK)
- **Cancelación post `accepted`** — conductor solo puede cancelar en estado `accepted`; no en estados posteriores
