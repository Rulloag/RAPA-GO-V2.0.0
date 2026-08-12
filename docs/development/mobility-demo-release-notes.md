# Release Notes — Demo MVP Movilidad

**Tag sugerido:** `demo-mobility-mvp-2026-06-03`
**Fecha:** 2026-06-03
**Estado:** Demo MVP Movilidad — Aprobado con observaciones menores
**Rama:** `main`
**Último commit:** `f0a9cff feat(mobile): connect RequestRidePage to Google Maps for real route-based ride requests`

---

## Resumen ejecutivo

El MVP de movilidad de RAPA GO V2.0.0 está técnicamente cerrado y listo para demo interna.
El flujo completo —desde solicitud del pasajero hasta ganancias del conductor— funciona de extremo a extremo con despacho manual por administrador.

---

## Funcionalidades incluidas

### Pasajero
- Solicitud de viaje con selección de origen/destino via Google Maps Places Autocomplete
- Visualización de ruta, distancia, duración y tarifa calculada antes de confirmar
- Vista de viajes activos e historial (filtros: todos / en curso / completados / cancelados)
- Seguimiento de estado del viaje con línea de tiempo (TripTimeline)
- Vista de información del conductor asignado (nombre, vehículo, teléfono, rating)
- Visualización de ubicación del conductor en mapa (actualización manual)
- Ruta visual conductor→origen (estados `accepted`/`driver_en_route`) y conductor→destino (`in_progress`)
- Cancelación de viaje en estados `requested` y `accepted`
- Calificación del conductor al completar el viaje

### Admin
- Dashboard con lista de solicitudes activas
- Vista de conductores disponibles
- Asignación manual de conductor a solicitud
- Historial de viajes

### Conductor
- Toggle de disponibilidad (available / unavailable) por zona de Rapa Nui
- Vista de viajes asignados activos
- Avance de estados: `accepted → driver_en_route → driver_arrived → in_progress → completed`
- Compartir ubicación GPS manualmente (botón "📍 Mi ubicación")
- Ruta visual hacia origen del pasajero (pre-pickup) y hacia destino (in_progress)
- Cancelación de viaje en estado `accepted`
- Tarjeta de ganancias del día en Home (se refresca al volver al tab)
- Página de ganancias: bruto, comisión app 20%, ganancia neta 80%
- Calificación del pasajero al completar

### Backend
- Cálculo de tarifa: `max(distancia_km × $2.300 CLP, $3.000 CLP mínimo)`
- Descuento por código referido (si aplica, no activado en demo)
- Transiciones de estado atómicas con validación de secuencia
- Liberación automática del conductor al completar o cancelar un viaje
- Endpoint de ubicación del conductor accesible solo al pasajero propietario del viaje
- Tracking GPS en segundo plano con plugin propio (`RapaGoBackgroundLocation`): foreground
  service en Android y `UIBackgroundModes: location` en iOS. Solo con viaje activo, con
  cola offline que reenvía los puntos por lotes al recuperar señal.
  Ver `docs/architecture/mobile-architecture.md`
- Ganancias calculadas sobre viajes completados en el día UTC actual
- 36 tests unitarios cubriendo auth, rides y earnings

---

## Funcionalidades NO incluidas en este MVP

| Funcionalidad | Motivo de exclusión |
|---------------|-------------------|
| WebSocket / realtime | Requiere infraestructura adicional; diferido a fase siguiente |
| Notificaciones push | Requiere FCM/APNs setup; diferido |
| Pagos reales / cobro al pasajero | Fuera de alcance MVP; los montos son referenciales |
| Wallet / saldo | Módulo existente pero sin lógica de pago real |
| Liquidaciones reales al conductor | Las ganancias son informativas |
| Navegación turn-by-turn | Solo ruta visual; no hay instrucciones de giro |
| Validación Google Routes API server-side | La distancia/duración viene del cliente (Maps SDK) |
| Asignación automática de conductor | El admin asigna manualmente |
| Módulo Turismo (Rentals / Guides) | Pantallas placeholder; sin backend funcional |

---

## Resultados de validaciones técnicas

| Comando | Resultado |
|---------|-----------|
| `npm run test --workspace=apps/api` | ✅ 36/36 passed |
| `npm run typecheck --workspace=apps/api` | ✅ 0 errores |
| `npm run build --workspace=apps/api` | ✅ OK |
| `npm run typecheck --workspace=apps/mobile` | ✅ 0 errores |
| `npm run build --workspace=apps/mobile` | ✅ OK (warning de chunk size — no bloqueante) |

---

## Estado de Git

- **Rama:** `main`, up to date con `origin/main`
- **Archivos .env:** No trackeados en Git (cubiertos por `.gitignore` — línea 69)
- **Cambios no commiteados:** Las partes 3–11 del MVP de movilidad están implementadas pero aún no commiteadas desde el último commit (`f0a9cff`)
- **Archivos sin trackear relevantes:**
  - `apps/api/scripts/seed-dev-users.ts`
  - `apps/api/src/db/migrations/0028_driver_location.sql`
  - `apps/api/src/modules/drivers/__tests__/` (7 tests earnings)
  - `apps/mobile/src/features/drivers/earnings.service.ts`
  - `docs/development/mobility-demo-guide.md`
  - `docs/development/mobility-mvp-status.md`
  - `docs/development/mobility-demo-release-notes.md` (este archivo)

> **Recomendación:** Crear un commit de cierre antes de tagear. Ver sección "Próximos pasos".

---

## Seguridad — Archivos sensibles

| Archivo | ¿En Git? | Estado |
|---------|----------|--------|
| `apps/api/.env` | ❌ No trackeado | ✅ Seguro — cubierto por `.gitignore` |
| `apps/mobile/.env` | ❌ No trackeado | ✅ Seguro — cubierto por `.gitignore` |
| `VITE_GOOGLE_MAPS_API_KEY` | ❌ No trackeado | ✅ Solo en `.env` local |
| `DATABASE_URL` | ❌ No trackeado | ✅ Solo en `.env` local |
| `JWT_SECRET` | ❌ No trackeado | ✅ Solo en `.env` local |

---

## Credenciales demo (entorno local)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Pasajero | passenger@rapago.local | Test1234! |
| Admin | admin@rapago.local | Test1234! |
| Conductor | driver@rapago.local | Test1234! |

---

## Variables de entorno requeridas

```env
# apps/api/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/rapago
JWT_SECRET=<string-aleatorio-largo>

# apps/mobile/.env
VITE_API_BASE_URL=/api
VITE_GOOGLE_MAPS_API_KEY=<key-de-google-cloud>
```

---

## Comandos para levantar el entorno demo

```bash
npm install
npm install --workspace=apps/api
npm run db:migrate --workspace=apps/api
npm run seed:dev --workspace=apps/api
npm run dev:api      # Terminal 1
npm run dev:mobile   # Terminal 2
```

---

## Riesgos conocidos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Google Maps API key con quota limitada | Media | Monitorear uso en Google Cloud Console antes de la demo |
| El pasajero no ve la ruta si el conductor no compartió ubicación | Baja | Documentado en guía; el conductor debe pulsar "📍 Mi ubicación" antes de mostrar al pasajero |
| Ganancias muestran $0 si no hay viajes completados hoy (UTC) | Baja | Completar al menos un viaje antes de mostrar esta sección |
| Sin realtime: el pasajero debe actualizar manualmente | Media | Explicado durante la demo como decisión de diseño MVP |
| `package-lock.json` modificado pero no commiteado | Baja | Incluir en el commit de cierre |

---

## Observaciones pendientes post-auditoría QA

| # | Severidad | Descripción |
|---|-----------|-------------|
| 1 | Baja | Ganancias en Home no recargan si el conductor completa y permanece en la misma página (la recarga se dispara al cambiar de tab gracias a `useIonViewWillEnter`) |
| 2 | Baja | El botón "Calificar" aparece inmediatamente al completar el viaje — aceptado como diseño MVP |

---

## Tag sugerido

```bash
# NO ejecutar sin autorización explícita de Rodrigo
git tag -a demo-mobility-mvp-2026-06-03 -m "Demo MVP Movilidad — flujo completo pasajero/admin/conductor"
git push origin demo-mobility-mvp-2026-06-03
```

> Antes de tagear se recomienda crear el commit de cierre con todos los cambios de las partes 3–11.

---

## Próximos pasos sugeridos

| Prioridad | Acción |
|-----------|--------|
| 1 | **Commit de cierre** — stagear todos los archivos de partes 3–11 y crear commit `feat(mobility): MVP movilidad completo — partes 3 a 11` |
| 2 | **Tag de demo** — `demo-mobility-mvp-2026-06-03` después del commit |
| 3 | **Demo interna** — ejecutar flujo con Rodrigo/Manuel usando `docs/development/mobility-demo-guide.md` |
| 4 | **Staging deploy** — configurar entorno de staging en VPS o plataforma cloud |
| 5 | **Notificaciones push** — Parte 12 siguiente: avisar al pasajero por cambio de estado |
| 6 | **Tracking automático** — Background geolocation + polling o WebSocket |
| 7 | **Pagos / wallet** — integrar pasarela y liquidación real |

---

## Documentación relacionada

- `docs/development/mobility-mvp-status.md` — estado técnico detallado, endpoints, estados y checklist
- `docs/development/mobility-demo-guide.md` — guion de demo paso a paso con frases sugeridas
- `docs/development/environment-variables.md` — referencia de variables de entorno del proyecto
