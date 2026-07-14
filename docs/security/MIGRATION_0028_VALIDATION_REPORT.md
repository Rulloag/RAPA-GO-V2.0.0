# Validación de migración `0028_wallet_transactions_ledger.sql`

> **ACTUALIZACIÓN 2026-07-14 (Fase 5):** los dos riesgos críticos identificados en este informe
> (journal desactualizado y tabla `payments` sin migración de origen) fueron reparados. El archivo
> `0028_wallet_transactions_ledger.sql` fue **archivado** (nunca se ejecutó vía `db:migrate` en
> ningún entorno) y reemplazado por dos migraciones oficiales generadas con `drizzle-kit generate`:
> `0017_next_natasha_romanoff.sql` (`payments`) y `0018_flippant_joshua_kane.sql`
> (`wallet_transactions_ledger`), ambas correctamente registradas en `_journal.json`. Ver el
> detalle completo de la reparación, la evidencia y el drift adicional encontrado en
> `docs/security/MIGRATION_SYSTEM_REMEDIATION_REPORT.md`. Este informe se conserva íntegro abajo
> como registro histórico del hallazgo original.

**Fecha:** 2026-07-14
**Rama:** `integration/leandro-security-remediation`
**Entorno de prueba:** base de datos PostgreSQL 16 local aislada (`rapago_migration_test_0028`),
creada y destruida exclusivamente para esta validación. **No se usó ni se modificó** la base de
datos de desarrollo real (`rapago`), ni ningún entorno de staging o producción. No se aplicó
ninguna migración fuera de este entorno desechable.

## Paso 1 — Validar sintaxis

**Resultado: OK.** La migración aplica sin errores de sintaxis SQL (`CREATE TABLE IF NOT EXISTS`,
5 `CREATE INDEX IF NOT EXISTS`, tipos, `CHECK`, `REFERENCES`, `DEFAULT gen_random_uuid()` —
soportado nativamente por PostgreSQL 16 sin extensión `pgcrypto`).

## Paso 2 — Confirmar compatibilidad con el schema actual

**Resultado: hallazgos críticos de infraestructura de migraciones (no del SQL de 0028 en sí).**

Al intentar reproducir el estado de esquema actual desde cero usando únicamente el mecanismo
oficial (`npm run db:migrate` / `drizzle-kit migrate`), se detectó lo siguiente:

1. **`_journal.json` no incluye las migraciones 0017 a 0028.** El journal de Drizzle
   (`apps/api/src/db/migrations/meta/_journal.json`) solo registra 17 entradas, hasta
   `0016_rare_garia`. Los archivos `0017_passenger_profiles.sql` ... `0028_wallet_transactions_ledger.sql`
   existen en el directorio pero **`drizzle-kit migrate` nunca los ejecuta**, en ningún entorno,
   porque el runner solo aplica lo que aparece en el journal. Esto significa que `npm run
   db:migrate` en un entorno nuevo (CI, staging, producción) **no crearía la tabla
   `wallet_transactions_ledger`** aunque el PR se mergee — el comando terminaría "exitosamente"
   sin aplicar la migración 0028, dando una falsa sensación de que todo está al día.
2. **La tabla `payments`, referenciada por `0028` (`payment_id UUID REFERENCES payments(id)`), no
   es creada por ningún archivo de migración del repositorio.** Existe en `rapago` (la base de
   dev real) y en `src/db/schema/payments.schema.ts`, pero fue creada fuera del flujo de
   migraciones versionadas (consistente con `drizzle-kit push` u otro método manual). Al replicar
   el esquema solo desde los archivos de migración, la 0028 falla con
   `relation "payments" does not exist`.
3. Como consecuencia de (1) y (2), la base de datos de desarrollo real (`rapago`) ya tiene tablas
   como `driver_profiles`, `referral_codes`, `fare_settings`, `payments`, etc. que **tampoco están
   respaldadas por el journal** — el esquema real y el historial de migraciones versionado están
   desincronizados desde antes de esta fase. Este PR no introduce esa desincronización, pero la
   migración 0028 hereda el problema: no puede aplicarse de forma confiable con el flujo estándar
   hasta que se resuelva.

Una vez neutralizado el problema (creando manualmente en el entorno de prueba las tablas
intermedias 0016–0027 y una tabla `payments` idéntica al schema real), la migración 0028 en sí
**es totalmente compatible**: todas sus columnas, tipos y FKs (`wallets`, `users`, `ride_requests`,
`payments`, auto-referencia a sí misma) coinciden exactamente con las tablas destino.

## Paso 3 — Confirmar que no duplica tablas, índices o constraints

**Resultado: OK.** La migración usa `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`
en todos sus objetos. Se re-ejecutó el archivo completo una segunda vez sobre la base ya migrada:
PostgreSQL emitió `NOTICE: relation "..." already exists, skipping` para cada objeto y no generó
ningún error ni duplicado. Verificado con `SELECT count(*) FROM pg_tables WHERE
tablename='wallet_transactions_ledger'` → `1`. No colisiona con ninguna tabla, índice o
constraint preexistente del schema (nombres `wallet_transactions_ledger*` e
`idx_wallet_tx_ledger_*` son exclusivos de esta migración).

## Paso 4 — Ejecución exclusiva en entorno local/de pruebas

**Resultado: OK.** Se creó la base `rapago_migration_test_0028` vía
`DROP DATABASE IF EXISTS ...; CREATE DATABASE ...` en el servidor Postgres local
(`localhost:5432`), se aplicó la migración ahí, y al finalizar la validación se ejecutó
`DROP DATABASE rapago_migration_test_0028`. Se confirmó explícitamente que la base de dev real
(`rapago`) sigue **sin** la tabla `wallet_transactions_ledger`
(`SELECT to_regclass('wallet_transactions_ledger')` → `NULL`). No se tocó ningún entorno de
staging ni producción; no existe conexión configurada a producción en este equipo.

## Paso 5 — Verificar rollback / estrategia de reversa

**Resultado: OK, rollback simple y seguro.**

- `DROP TABLE wallet_transactions_ledger;` (o `DROP TABLE IF EXISTS ...;` para idempotencia)
  revierte la migración por completo.
- La tabla es una **hoja** en el grafo de FKs: ninguna otra tabla del sistema la referencia desde
  afuera (solo se autorreferencia a través de `reversal_of_transaction_id` /
  `settles_transaction_id`), por lo que el `DROP TABLE` no requiere `CASCADE` y no arrastra
  ninguna otra tabla.
- Se verificó en un `BEGIN; DROP TABLE ...; ROLLBACK;` que la operación es transaccional y
  reversible dentro de una misma sesión, y luego se ejecutó el `DROP TABLE` real, confirmando que
  `wallets` y `payments` permanecen intactas después de eliminar la tabla del ledger.
- No existe un script de rollback SQL formal en el repositorio (no hay convención de migraciones
  "down" en este proyecto — todas las migraciones existentes son solo "up"); se documenta aquí el
  comando exacto de reversa para uso manual si fuera necesario.

## Paso 6 — Tests y builds después de aplicar la migración

- `npm run test --workspace=apps/api` → **117/117 pruebas pasando** (11 archivos), sin
  regresiones. **Nota:** la suite de tests usa mocks de base de datos (`vi.mock`), no una
  conexión real — por eso el resultado no cambia con o sin la migración aplicada; la validación
  real de la tabla se hizo por separado con SQL directo (paso 7).
- `npm run build --workspace=apps/api` → **OK**, 0 errores de compilación TypeScript.
- `npm run build --workspace=apps/mobile` → **OK**, build exitoso (mismo warning preexistente de
  tamaño de chunk, no relacionado con esta migración).

## Paso 7 — Pruebas funcionales contra la tabla real

Se sembraron datos de prueba (1 usuario pasajero, 2 usuarios admin, 1 wallet, 1 viaje) y se
ejecutaron directamente sobre `wallet_transactions_ledger` en la base de pruebas:

| Escenario | Resultado |
|---|---|
| Crédito manual ≤$3.000 (auto-aprobado, `status=available`, `approval_status=admin_approved`) | ✅ Insertado correctamente |
| Débito autoritativo de no-show vinculado a `ride_id` (`status=applied`) | ✅ Insertado correctamente |
| Reintento con la misma `idempotency_key` (`credit:test-key-001`) | ✅ Rechazado por la base (`duplicate key value violates unique constraint "wallet_transactions_ledger_idempotency_key_key"`) |
| Reversa del débito de no-show (`type=reversal`, `reversal_of_transaction_id` apunta al débito original) | ✅ Insertado correctamente, FK de autorreferencia funcional |
| Crédito manual >$3.000 creado por `admin1`, aprobado por `admin2` (dos administradores distintos) | ✅ Transición `pending/pending_review` → `available/admin_approved` correcta |
| Cálculo de saldo agregado (`SUM` de créditos disponibles + reversas aplicadas − débitos aplicados) | ✅ `2.500 + 5.000 + 3.000 (reversa) − 3.000 (débito) = 7.500` — consistente con el patrón usado por `syncWalletBalanceCache` |

Todos los escenarios requeridos (crédito, débito, reversa, idempotencia, no-show) se comportan
según lo diseñado en el ledger.

## Datos de prueba afectados

Únicamente datos sintéticos creados y destruidos dentro de `rapago_migration_test_0028`: 3
usuarios (`passenger@rapago.cl`, `admin1@rapago.cl`, `admin2@rapago.cl`), 1 wallet, 1 `ride_request`,
5 filas de `wallet_transactions_ledger`, y una tabla `payments` recreada manualmente solo para
esta prueba (réplica exacta del schema real, necesaria porque ningún archivo de migración la
crea — ver Paso 2). Toda la base fue eliminada al finalizar (`DROP DATABASE`). **Ningún dato real
de usuarios, viajes ni pagos fue leído, modificado ni creado.**

## Riesgos abiertos

- **CRÍTICO — `_journal.json` desactualizado:** las migraciones 0017–0028 (incluida esta) no
  están registradas en el journal de Drizzle. `npm run db:migrate` no las aplicará en ningún
  entorno nuevo (CI, staging, producción), aunque el comando reporte éxito. Debe regenerarse el
  journal (`drizzle-kit generate` a partir del estado real de schema.ts, o edición manual
  cuidadosa de `_journal.json`) **antes** de confiar en `db:migrate` para desplegar esta
  migración. Alternativa mínima: aplicar 0028 manualmente vía `psql -f
  0028_wallet_transactions_ledger.sql` en cada entorno, documentando la excepción.
- **CRÍTICO — tabla `payments` sin migración de origen:** `payments.schema.ts` define esta tabla
  y la migración 0028 depende de ella vía FK, pero ningún `.sql` en `migrations/` la crea. En
  cualquier entorno provisionado solo desde los archivos de migración (por ejemplo, un ambiente
  de staging nuevo), la 0028 fallará con `relation "payments" does not exist`. Se recomienda
  generar la migración faltante para `payments` (y auditar si hay otras tablas del schema.ts en
  la misma situación) antes de aplicar 0028 en cualquier entorno que no sea `rapago` (dev actual,
  que ya la tiene por vía manual).
- **MEDIO (heredado, ya documentado):** umbral de aprobación de créditos manuales ($3.000 CLP)
  sigue como política provisional pendiente de confirmación del equipo de negocio — ver
  `docs/security/WALLET_SYSTEM_UNIFICATION_REPORT.md`.
- **BAJO:** no existe un mecanismo formal de rollback "down" en el proyecto (ningún archivo de
  migración lo tiene); el rollback de 0028 documentado aquí es manual.

La migración **0028 en sí misma es correcta, idempotente y funcionalmente válida** — los
problemas críticos encontrados son de la infraestructura de migraciones del repositorio (journal
desincronizado y tabla `payments` huérfana), preexistentes a este PR pero que **bloquean su
aplicación confiable** vía el flujo estándar (`db:migrate`) hasta resolverse.

---

```text
MIGRACIÓN APLICADA EN ENTORNO DE PRUEBAS: SÍ
SCHEMA CONSISTENTE: NO (0028 es correcta, pero depende de una tabla `payments` sin migración
  propia, y ni 0017–0028 están registradas en _journal.json, por lo que `db:migrate` no la
  aplicaría en un entorno nuevo)
ROLLBACK VALIDADO: SÍ (DROP TABLE IF EXISTS wallet_transactions_ledger; — sin dependientes)
TESTS API: 117/117 (suite con mocks; no ejercitan la tabla real — ver Paso 6)
BUILD API: OK
BUILD MOBILE: OK
DATOS DE PRUEBA AFECTADOS: solo sintéticos en base desechable rapago_migration_test_0028
  (eliminada al finalizar); rapago (dev real) no fue tocada
RIESGOS ABIERTOS: 2 críticos (journal de migraciones desactualizado; tabla `payments` sin
  migración de origen) + 1 medio heredado (umbral de aprobación provisional) + 1 bajo (sin
  rollback "down" formal)
APTO PARA MERGE A MAIN: NO — el SQL de 0028 es correcto y seguro, pero antes de mergear se debe
  resolver el journal desincronizado y generar la migración faltante de `payments` (o documentar
  y aplicar 0028 manualmente en cada entorno como excepción explícita); de lo contrario el PR
  daría una falsa sensación de que `npm run db:migrate` deja el ledger operativo cuando en
  realidad no lo aplicaría en ningún entorno nuevo.
```
