# TRUE STAGING ISOLATION — Runbook operativo
# Fecha: 2026-08-25
# Branch: rodrigo/true-staging-isolation-20260825
#
# Arquitectura objetivo:
#   staging.rapago.cl
#     → https://backend-staging.rapago.cl/api   (Node app SEPARADO)
#     → DB / Supabase proyecto STAGING         (SEPARADO de prod)
#     → Klap SANDBOX + webhooks → backend-staging
#     → SMTP test / sink (NO prod)
#
# Prohibido:
#   - Modificar env Node de backend.rapago.cl (prod)
#   - Escribir / migrar DB producción
#   - Copiar ApiKey Klap prod o SMTP prod a staging
#   - Cobros reales / discovery capture en staging
#   - Debilitar headers Helmet

---

## 0. Estado de acceso (rellenar al ejecutar)

| Recurso | ¿Acceso? | Evidencia |
|---------|----------|-----------|
| Hostinger panel / SSH Node | NO / YES | |
| DNS write (backend-staging.rapago.cl) | NO / YES | |
| Supabase admin (proyecto nuevo staging) | NO / YES | |
| Klap merchant sandbox | NO / YES | |
| SMTP test mailbox | NO / YES | |
| Google Cloud OAuth/Maps staging | NO / YES | |
| Apple Developer Services ID staging | NO / YES | |

Si cualquier fila es NO → marcar `EXTERNAL_BLOCKER` y **no** afirmar aislamiento completo.

---

## 1. Código / build (repo — ya listo)

| Artefacto | Ruta | Rol |
|-----------|------|-----|
| FE staging env | `apps/mobile/.env.staging.template` | `VITE_API_BASE_URL=https://backend-staging.rapago.cl/api` |
| Guard Vite | `apps/mobile/vite.config.ts` | Staging FAIL si apunta a `backend.rapago.cl`; prod FAIL si apunta a staging |
| BE staging env | `apps/api/.env.staging.template` | APP_ENV=staging, DB/Klap/SMTP placeholders separados |
| CORS | `apps/api/src/plugins/cors.ts` | Con `APP_ENV=staging` añade `https://staging.rapago.cl` |
| Seed plan | `docs/release/STAGING_SEED_PLAN.md` | Usuarios mínimos no-PII |
| Script check | `scripts/release/verify-staging-isolation.mjs` | Verifica templates + guards |

### Builds locales

```bash
cp apps/mobile/.env.staging.template apps/mobile/.env.staging
npm run build -w @rapa-go/shared
npm run typecheck
npm run build:staging -w @rapa-go/mobile
npm run build:prod -w @rapa-go/mobile
node scripts/release/verify-staging-isolation.mjs
```

Evidencia esperada staging bundle: strings `backend-staging.rapago.cl`, **ausencia** de `backend.rapago.cl` como API host.

---

## 2. Hostinger — Node app backend-staging (EXTERNAL)

**NO tocar** el app Node de `backend.rapago.cl`.

1. Crear aplicación Node **nueva** (nombre sugerido: `rapago-backend-staging`).
2. DNS: `backend-staging.rapago.cl` → IP/host del nuevo app (A/CNAME). SSL Let's Encrypt.
3. Deploy mismo artefacto API que prod (build `apps/api`), **env distinto**.
4. Pegar variables desde `apps/api/.env.staging.template` (valores reales staging).
5. Verificar:
   - `APP_ENV=staging`
   - `DATABASE_URL` apunta solo a proyecto staging
   - `KLAP_ENVIRONMENT=sandbox` + ApiKey sandbox
   - Webhooks `https://backend-staging.rapago.cl/api/webhooks/klap/*`
   - `CORS_ORIGIN` incluye `https://staging.rapago.cl`
6. Health: `curl -sI https://backend-staging.rapago.cl/api/health`
7. Confirmar Helmet sigue activo (headers `X-Content-Type-Options`, etc.) — no desactivar.

### Checklist anti-prod

- [ ] El panel muestra **dos** apps Node distintos (prod vs staging)
- [ ] Env staging **no** contiene host/credenciales de la DB prod
- [ ] Restart solo del app staging

---

## 3. Base de datos staging (EXTERNAL)

1. Crear proyecto Supabase **nuevo** (ej. `rapago-staging`).
2. Copiar connection string SSL a `DATABASE_URL` del Node staging **únicamente**.
3. Migraciones **solo** contra staging:

```bash
# En máquina con DATABASE_URL=staging (nunca prod):
export DATABASE_URL='postgresql://…staging…'
cd apps/api
npm run migrate:prod
# migrate:prod = drizzle journal (hasta lo registrado) + cadena manual 0056→0058
# Si hace falta cadena manual sola:
npm run db:migrate:manual
```

4. Journal drizzle llega típicamente hasta `0047_*`; archivos `0048`–`0055` son huérfanos documentados (ver `MANUAL_MIGRATIONS_0056_0058_RUNBOOK.md`). En **DB staging nueva**, decidir con DBA:
   - Opción A (recomendada staging fresco): aplicar journal + manual 0056–0058; luego evaluar huérfanos 0048–0055 si el schema seed/legal lo requiere.
   - Opción B: snapshot schema anonimizado desde prod (estructura only) — solo con proceso aprobado; **nunca** datos PII.
5. Verificar última migración aplicada en staging (`rapago_manual_migrations` / drizzle meta).
6. Seed mínimo: ver `STAGING_SEED_PLAN.md` — emails `*@staging.rapago.local`, sin PII real.

**PROHIBIDO:** `migrate:prod` con `DATABASE_URL` de producción en esta fase.

---

## 4. Klap sandbox (EXTERNAL)

| Variable | Valor staging |
|----------|---------------|
| `KLAP_ENVIRONMENT` | `sandbox` |
| `KLAP_API_KEY` | ApiKey **sandbox** (portal merchant) — NO prod |
| Orders URL | `KLAP_SANDBOX_ORDERS_URL` |
| Return/Cancel | `https://staging.rapago.cl/passenger/trips?payment=…` |
| Webhooks | `https://backend-staging.rapago.cl/api/webhooks/klap/{confirm,reject,validate}` |

En portal Klap: registrar webhooks y return URLs del host **backend-staging** / **staging**.  
`KLAP_CAPTURE_DISCOVERY_MODE=false`.  
`NO_REAL_PAYMENT=YES` (sandbox only).

---

## 5. Email / SMTP test (EXTERNAL)

- Mailtrap / Mailosaur / buzón Hostinger **test** dedicado.
- Variables `SMTP_*` del template staging — **no** reutilizar prod.
- Smoke: registro / reset password → mensaje solo en sink test.

---

## 6. Google / Apple staging (EXTERNAL)

| Proveedor | Acción |
|-----------|--------|
| Google OAuth | JS origin `https://staging.rapago.cl`; Client ID staging en FE+BE |
| Google Maps | Referrer `https://staging.rapago.cl/*` |
| Apple | Services ID + return `https://backend-staging.rapago.cl/auth/apple/web/callback`; FE `APPLE_WEB_FRONTEND_URL=https://staging.rapago.cl` |

---

## 7. Deploy frontend staging (EXTERNAL)

```bash
cp apps/mobile/.env.staging.template apps/mobile/.env.staging
# Completar Maps / Google client id staging
npm run build:staging -w @rapa-go/mobile
# Subir apps/mobile/dist → public_html de staging.rapago.cl
```

Post-deploy auditoría:

```bash
# En el HTML/JS publicado no debe aparecer backend.rapago.cl como API
rg -n 'backend\.rapago\.cl' apps/mobile/dist || true
rg -n 'backend-staging\.rapago\.cl' apps/mobile/dist
```

---

## 8. Re-auditoría de aislamiento + canary

1. Crear usuario canary **solo** en DB staging (`canary+qa@staging.rapago.local`).
2. Crear viaje canary solo en staging.
3. Confirmar **ausencia** de esos IDs/emails en DB prod (SELECT read-only prod — sin writes).
4. Pago sandbox opcional; verificar webhook llega a backend-staging.

### Gate READY_FOR_QA_STAGING

Todos deben ser YES:

- `BACKEND_STAGING_SEPARATE`
- `DB_STAGING_SEPARATE`
- `KLAP_STAGING_SEPARATE`
- `EMAIL_STAGING_SEPARATE`
- `STAGING_FRONTEND_USES_STAGING_API`

Si falta alguno → `READY_FOR_QA_STAGING=NO`.

---

## 9. Accesos exactos necesarios (si blocked)

1. **Hostinger**: login panel + permiso crear Node app + DNS `backend-staging.rapago.cl` + deploy FE `staging.rapago.cl`.
2. **Supabase**: crear proyecto + connection string + (opcional) SQL editor.
3. **Klap**: portal comercio sandbox + registrar webhooks staging.
4. **SMTP**: credenciales buzón test.
5. **Google Cloud**: OAuth client + Maps key referrers staging.
6. **Apple Developer**: Services ID + return URL backend-staging.

Sin esos accesos, el repo queda en **code readiness** únicamente.
