# Preferencia de Conductora Mujer

## 1. Objetivo funcional

Permite al pasajero indicar que prefiere ser atendido por una conductora mujer.

La preferencia es un filtro operativo, no una garantía. El sistema:

- Intenta asignar una conductora si hay una disponible y conectada.
- No asigna un conductor hombre automáticamente mientras la preferencia esté activa.
- Informa al pasajero cuando no hay conductora disponible y le ofrece alternativas.
- Preserva la preferencia en viajes programados y multi-destino.

---

## 2. Flujo pasajero

### Solicitar viaje con preferencia

1. El pasajero activa el toggle **"Prefiero conductora mujer"** en la pantalla de solicitud.
2. El payload enviado incluye `preferredDriverGender: "female"`.
3. El backend filtra el pool de conductores disponibles al género femenino.

### Resultado A — conductora disponible

- La conductora es asignada automáticamente.
- `status = accepted`, `preferredDriverGender = "female"`.
- Mensaje: *"Conductora asignada."*

### Resultado B — conductora ocupada (queued offer)

- Existe una conductora con `availability = busy` y viaje `in_progress`.
- El sistema crea un queued offer solo hacia esa conductora.
- `queuedOfferPending = true`, `queuedOfferExpiresAt` presente.
- El ride queda en `requested` hasta que la conductora acepte o expire el offer.

### Resultado C — sin conductora disponible

- No hay conductora available ni busy con ubicación reciente.
- `preferredDriverUnavailable = true`, `status = requested`.
- El mobile muestra un `IonAlert` con dos opciones:

  | Opción | Comportamiento |
  |---|---|
  | **Esperar conductora** | Cierra la alerta. El ride queda en `requested` sin cambios. |
  | **Continuar con cualquier conductor** | Llama `PATCH /rides/:id/accept-any-driver`. Backend limpia la preferencia y reintenta auto-asignación sin filtro de género. |

### Viaje programado con preferencia

- Se guarda `preferredDriverGender = "female"` en el ride.
- No se auto-asigna conductor al crear (comportamiento estándar de viajes programados).
- El admin ve el badge y debe asignar manualmente.

---

## 3. Reglas de negocio

| Regla | Detalle |
|---|---|
| Único valor soportado | `"female"`. `null` = sin preferencia. |
| No asignación cruzada | Mientras `preferredDriverGender = "female"`, el sistema nunca asigna un conductor hombre automáticamente. |
| Queued offers respetan preferencia | El offer solo se crea para conductoras. Conductores hombres busy son ignorados. |
| Multi-destino respeta preferencia | El payload puede incluir `destinations[]`, `segments[]` y `preferredDriverGender` simultáneamente. |
| Viajes programados guardan preferencia | No auto-asignan. La preferencia queda almacenada para el momento de asignación manual. |
| `accept-any-driver` limpia preferencia | Pone `preferred_driver_gender = null` antes de reintentar. No se puede revertir desde el mobile. |
| Admin puede asignar con advertencia | La asignación manual no está bloqueada. El sistema advierte pero no impide la acción. |

---

## 4. Modelo de datos

### `driver_profiles.gender`

```sql
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
```

| Valor | Significado |
|---|---|
| `"female"` | Conductora mujer |
| `"male"` | Conductor hombre |
| `NULL` | No informado |

### `ride_requests.preferred_driver_gender`

```sql
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS preferred_driver_gender VARCHAR(10);
```

| Valor | Significado |
|---|---|
| `"female"` | Pasajero prefiere conductora mujer |
| `NULL` | Sin preferencia |

Migración: `apps/api/src/db/migrations/0032_driver_gender_preference.sql`

### Seed demo

| Usuario | Género |
|---|---|
| `driver@rapago.local` | `male` |
| `driver2@rapago.local` | `female` |

---

## 5. Endpoints

### `POST /api/rides/request`

Campo adicional en el body:

```json
{
  "preferredDriverGender": "female"
}
```

Campos adicionales en la respuesta cuando hay preferencia activa:

| Campo | Tipo | Cuándo aparece |
|---|---|---|
| `preferredDriverGender` | `"female" \| null` | Siempre |
| `preferredDriverUnavailable` | `boolean` | Cuando no hay conductora y la preferencia está activa |
| `queuedOfferPending` | `boolean` | Cuando se creó un queued offer hacia conductora |
| `queuedOfferExpiresAt` | `string \| null` | Cuando `queuedOfferPending = true` |

### `PATCH /api/rides/:id/accept-any-driver`

- Autenticación: pasajero dueño del viaje.
- Requisitos: `status = requested`, `preferredDriverGender` no null.
- Efecto: limpia `preferred_driver_gender = null`, reintenta auto-asignación sin filtro.
- Respuesta: ride actualizado (igual que `POST /rides/request`).

---

## 6. UI pasajero

### Toggle

Ubicación: pantalla `RequestRidePage`, sección inferior antes del botón de confirmar.

Texto principal: *"Prefiero conductora mujer"*

Disclaimer visible bajo el toggle:
> *"Intentaremos asignarte una conductora si hay una disponible y conectada. No podemos garantizar disponibilidad."*

### Alerta cuando no hay conductora

Título: *"No hay conductoras disponibles"*

Mensaje:
> *"No hay conductoras disponibles en este momento. Puedes esperar o continuar con cualquier conductor disponible."*

Botones:

| Botón | Acción |
|---|---|
| Esperar conductora | Cierra alerta. Ride queda sin cambios. |
| Continuar con cualquier conductor | Llama `acceptAnyDriver`. Si hay conductor available, se asigna. |

---

## 7. UI admin

### Badge en tarjetas de viaje

Cuando `ride.preferredDriverGender === "female"`:

- Se muestra badge **"♀ Prefiere conductora mujer"** (color `secondary`) junto a los badges de estado y tipo.
- Visible en la sección Viajes (`AdminTripsPage`).

### Advertencia antes de asignar

Al pulsar **"Asignar conductor"** en un viaje con preferencia activa:

- Se muestra un `IonAlert` antes de ejecutar la asignación:

  > *"Este pasajero solicitó una conductora mujer. No se puede verificar el género del conductor seleccionado desde este panel. ¿Deseas asignar de todas formas?"*

- Botones: **Volver** (cancela) / **Asignar de todas formas** (ejecuta asignación).
- La asignación no está bloqueada — el admin puede confirmar.

> **Nota:** El panel admin actualmente no recibe el género de los conductores activos desde el endpoint `/admin/drivers/active`. La advertencia es genérica.

---

## 8. QA validada (PARTE 28E)

Todos los escenarios verificados con API local y seed demo.

| Escenario | Resultado |
|---|---|
| Viaje sin preferencia — auto-asignación normal | ✅ |
| Preferencia activa — conductora disponible asignada | ✅ |
| Preferencia activa — conductor hombre disponible, conductora no | ✅ no asigna hombre |
| `preferredDriverUnavailable = true` retornado correctamente | ✅ |
| Pasajero elige "Esperar conductora" — ride queda sin cambios | ✅ |
| Pasajero elige "Continuar" — `accept-any-driver` asigna hombre | ✅ |
| Queued offer creado solo para conductora busy | ✅ |
| Viaje programado guarda preferencia, no auto-asigna | ✅ |
| Multi-destino con preferencia — conductora asignada, paradas OK | ✅ |
| Admin ve badge en viajes con preferencia | ✅ |
| Admin recibe advertencia antes de asignar | ✅ (code review) |
| **Tests API** | ✅ 122/122 |
| `typecheck` API y mobile | ✅ 0 errores |
| `build` API y mobile | ✅ OK |

---

## 9. Limitaciones conocidas

| Limitación | Impacto |
|---|---|
| `GET /admin/drivers/active` no devuelve `gender` | El admin no puede verificar el género del conductor antes de asignar manualmente. La advertencia es genérica. |
| No hay push notification cuando aparece una conductora | Si el pasajero eligió "Esperar", no recibe aviso activo. Debe refrescar manualmente. |
| Género solo es filtro operativo | No se expone al pasajero qué conductor le fue asignado según género. |
| Solo se soporta `"female"` como valor de preferencia | No existe opción "Prefiero conductor hombre" ni campo `gender` del conductor en la respuesta al pasajero. |
| Admin puede ignorar la preferencia | La advertencia informa pero no bloquea la asignación manual de un conductor hombre. |

---

## 10. Próximos pasos posibles

| Mejora | Descripción |
|---|---|
| Exponer `gender` de conductores activos al admin | Permitir que el admin filtre y vea el género de cada conductor disponible antes de asignar. Requiere cambio en `listActiveDrivers` y `ActiveDriverResponse`. |
| Push notification al pasajero | Cuando aparezca una conductora disponible y el pasajero tenga un ride en `requested` con preferencia activa, notificar proactivamente. |
| Auditoría de asignación con preferencia | Registrar cuando admin asignó un conductor hombre a un viaje con preferencia femenina. |
| Métricas de disponibilidad | Dashboard con ratio conductoras activas / viajes con preferencia, para evaluar cobertura operacional. |
| Soporte `"male"` en preferencia | Si operacionalmente hace sentido, habilitar preferencia de conductor hombre. Requiere cambio mínimo en el esquema Zod y en el filtro de auto-asignación. |
