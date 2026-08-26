# Staging seed plan (mínimo, no-PII)

Ejecutar **solo** con `DATABASE_URL` del proyecto Supabase staging.
Nunca contra producción. Nunca emails/telefonos/RUT reales.

## Objetivo

Datos mínimos para QA de registro, viajes, cancelaciones y pagos sandbox.

## Usuarios sugeridos

| Email | Rol | Password (solo staging) | Notas |
|-------|-----|-------------------------|-------|
| `passenger.canary@staging.rapago.local` | passenger | generar en host (no git) | Canary FE |
| `driver.canary@staging.rapago.local` | driver | generar en host | Perfil aprobado + vehículo |
| `admin.canary@staging.rapago.local` | admin | generar en host | Solo si hace falta panel |

Reglas:

- Dominio `.staging.rapago.local` o `+staging@` en buzón test.
- Nombres ficticios (`Canary Passenger`, `Canary Driver`).
- Teléfonos placeholder tipo `+56900000001` (no reales).
- Sin documentos de identidad reales.

## Cómo sembrar

Opción A — adaptar `apps/api/scripts/seed-dev-users.ts` localmente (no commitear passwords):

```bash
# APP_ENV=staging y DATABASE_URL=staging
# NODE_ENV no debe ser "production" para el seed-dev actual,
# o usar un one-off SQL/script en la máquina ops con guardas:
#   fail si DATABASE_URL contiene el project-ref de prod
NODE_ENV=development APP_ENV=staging DATABASE_URL='…staging…' \
  npm run seed:dev --workspace=apps/api
```

Opción B — inserts SQL manuales vía Supabase SQL Editor del **proyecto staging**.

## Post-seed verificación

```sql
SELECT id, email, role FROM users
WHERE email LIKE '%@staging.rapago.local';
```

Guardar IDs canary para la re-auditoría. Confirmar que esos emails **no** existen en prod (SELECT read-only).

## Viaje canary

1. Login passenger canary en `https://staging.rapago.cl`.
2. Crear solicitud de viaje (origen/destino ficticios Rapa Nui).
3. Aceptar con driver canary.
4. Cancelar / completar según caso QA.
5. Pago: solo Klap sandbox; verificar fila solo en DB staging.

## Prohibido

- Copiar tablas users/rides de prod.
- Export dumps con PII.
- Reutilizar passwords de prod.
