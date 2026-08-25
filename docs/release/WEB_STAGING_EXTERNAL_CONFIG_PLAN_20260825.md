# RAPA GO V2.0.01 — Web Fase 2: plan de configuración externa (staging)

Fecha: 2026-08-25  
Rama: `rodrigo/web-white-label-readiness-20260825`  
Ámbito: **READ/PLAN ONLY**. Sin deploy, DNS live, Google Console, Apple Developer, Klap, migraciones prod, commit ni push.

Evidencia principal: `apps/mobile/.env.staging.template`, `apps/api/.env.example`, `apps/api/src/plugins/cors.ts`, `docs/release/WEB_WHITE_LABEL_READINESS_20260825.md`, `docs/release/RAPAGO-KLAP-ELEMENTS-DEPLOY-20260818.md`, `docs/release/MANUAL_MIGRATIONS_0056_0058_RUNBOOK.md`.

---

## 1. DNS y hosting (`staging.rapago.cl`)

| Ítem | Valor | Evidencia / estado |
|------|-------|-------------------|
| Hostname | `staging.rapago.cl` | Propuesto en plantillas/docs white-label |
| Tipo de registro | **A** (si apunta a IP del plan Hostinger) **o CNAME** (si Hostinger entrega alias de subdominio) | EXTERNAL_INFO_REQUIRED — no hay registro DNS de staging en repo |
| Target | EXTERNAL_INFO_REQUIRED | IP Hostinger documentada para **frontend prod** `api.rapago.cl`: `212.85.6.237` (`docs/release/RAPAGO-KLAP-ELEMENTS-DEPLOY-20260818.md`). **No inventar** que staging usa la misma IP sin confirmar en panel DNS/Hostinger |
| TTL | EXTERNAL_INFO_REQUIRED (típicamente 300–3600 en Hostinger; no fijado en repo) | — |
| SSL | Requerido (HTTPS) — Let's Encrypt / panel Hostinger | EXTERNAL_INFO_REQUIRED (emisión post-DNS) |
| Public root | Propuesto: carpeta estática tipo `~/domains/staging.rapago.cl/public_html` (patrón Hostinger actual: `~/domains/api.rapago.cl/public_html`) | EXTERNAL_INFO_REQUIRED — confirmar subdominio/creado en Hostinger |
| SPA fallback | `index.html` + excluir `/.well-known/` | Patrón prod en docs Klap / ROUTES_BLACK_SCREEN_FIX |

**HOSTING_TARGET_KNOWN=PARTIAL** — Hostinger + patrón `public_html` conocidos para prod; target DNS exacto de staging = EXTERNAL_INFO_REQUIRED.

---

## 2. Frontend staging env (matriz desde `.env.staging.template`)

Fuente: `apps/mobile/.env.staging.template` (+ notas de `.env.example` / white-label).

| VARIABLE | VALOR ESPERADO / TIPO | ORIGEN | SECRETO? | VISIBLE EN BROWSER? | CONFIG EXTERNA? |
|----------|----------------------|--------|----------|---------------------|-----------------|
| `VITE_API_BASE_URL` | URL `https://backend.rapago.cl/api` | Template staging | No (público) | Sí (bundle) | No (valor de build) |
| `VITE_API_URL` | Opcional alias mismo host `/api` | Comentario template | No | Sí si se define | No |
| `VITE_ENV` | `staging` | Template | No | Sí | No |
| `VITE_GOOGLE_MAPS_API_KEY` | Clave browser (placeholder vacío) | Google Cloud | Semi-público (restringir referrer) | Sí | Sí — referrers/APIs |
| `VITE_GOOGLE_WEB_CLIENT_ID` | OAuth Web Client ID `*.apps.googleusercontent.com` | Google Cloud | No (client id) | Sí | Sí — JS origins |
| `VITE_KLAP_ELEMENTS_ENABLED` | `false` (staging template) | Template | No | Sí | No (flag FE) |
| `VITE_KLAP_CHECKOUT_FLEX_SCRIPT_URL` | `https://sandbox.mcdesaqa.cl/pagos/checkout-flex/v1/main.min.js` | Template sandbox | No | Sí | Sandbox Klap ya público |
| `VITE_FEATURE_TOURISM` | `false` | Template | No | Sí | No |
| `VITE_FEATURE_RENTALS` | `false` | Template | No | Sí | No |
| `VITE_FEATURE_EVENTS` | `false` | Template | No | Sí | No |

**Backend (no VITE_, no en bundle SPA)** — relevante para staging FE que habla con API:

| VARIABLE | Notas staging |
|----------|----------------|
| `CORS_ORIGIN` | Debe incluir `https://staging.rapago.cl` en Hostinger (ver §3) |
| `KLAP_RETURN_URL` / `KLAP_CANCEL_URL` | Apuntar a staging FE cuando se pruebe pagos sandbox |
| `APPLE_WEB_FRONTEND_URL` | `https://staging.rapago.cl` en ambiente staging |
| `DATABASE_URL` | DB **staging** separada (diseño §8) |

Sin secretos reales en este plan.

---

## 3. Backend / CORS

**Archivo código:** `apps/api/src/plugins/cors.ts`  
**Env ejemplo:** `apps/api/.env.example` → `CORS_ORIGIN=…,https://staging.rapago.cl,…`  
**Docs deploy:** `apps/api/DEPLOY.md`

### CURRENT_ALLOWED_ORIGINS (defaults en código)

De `DEFAULT_ALLOWED_ORIGINS` en `cors.ts`:

- `https://api.rapago.cl`
- `https://app.rapago.cl`
- `https://rapago.cl`
- `https://www.rapago.cl`
- localhost / Capacitor variants

**STAGING_ORIGIN_PRESENT (defaults código)=NO** — `https://staging.rapago.cl` **no** está en `DEFAULT_ALLOWED_ORIGINS`.

**STAGING_ORIGIN_PRESENT (.env.example)=YES** — listado en `CORS_ORIGIN` de ejemplo.

**¿Puede permitirse `https://staging.rapago.cl`?** Sí — vía `CORS_ORIGIN` y/o `FRONTEND_URL` (unión con defaults en `getAllowedCorsOrigins()`).

**CHANGE_REQUIRED=YES** en el **entorno real** del backend Hostinger si `CORS_ORIGIN` productivo aún no incluye `https://staging.rapago.cl` (valor live = EXTERNAL_INFO_REQUIRED). Código repo ya documenta el valor; defaults no bastan.

`CORS_CHANGE_REQUIRED=YES` (ops env, no necesariamente cambio de código).

---

## 4. Google OAuth (GIS — id_token; sin cambios de consola aquí)

Flujo: `VITE_GOOGLE_WEB_CLIENT_ID` + Google Identity Services (sin redirect OAuth clásico). Evidencia: `docs/release/WEB_WHITE_LABEL_READINESS_20260825.md`.

| Ambiente | AUTHORIZED_JAVASCRIPT_ORIGIN | REDIRECT_URI |
|----------|------------------------------|--------------|
| Staging | `https://staging.rapago.cl` | No usado por flujo GIS actual. Si la consola exige ≥1: mismo origen HTTPS o vacío según política del cliente Web |
| Production (`app.rapago.cl`) | `https://app.rapago.cl` | Igual — no path de login SPA |
| Legacy hasta cutover | `https://api.rapago.cl` | — |
| Dev | `http://localhost:5173` | — |

Backend valida audience: `GOOGLE_WEB_CLIENT_ID` / `GOOGLE_ALLOWED_CLIENT_IDS` (`apps/api/.env.example`).

---

## 5. Google Maps (sin cambios de key aquí)

**HTTP referrers (browser key `VITE_GOOGLE_MAPS_API_KEY`):**

- `https://staging.rapago.cl/*`
- `https://app.rapago.cl/*`
- (legacy hasta cutover) `https://api.rapago.cl/*`

**APIs reales usadas por el proyecto** (código, no inventar extras):

| API | Dónde |
|-----|--------|
| Maps JavaScript API | `useGoogleMaps.ts`, `MapFallback.tsx`, Map/DirectionsService/Geocoder en páginas pasajero |
| Places API | `places` library / `PlacesService` / `AutocompleteService` |
| Geocoding API | `google.maps.Geocoder` en cliente |
| Directions API | Cliente: `DirectionsService`; Backend receipts: `/maps/api/directions/json` (`rideReceiptMap.service.ts`) |
| Maps Static API | Backend receipts: `/maps/api/staticmap` |

Nota: `docs/architecture/maps-architecture.md` menciona Distance Matrix; **no** se listó uso concreto en búsqueda de `apps/api/src` para este plan — no incluir en checklist de enablement obligatorio sin evidencia nueva.

Clave servidor `GOOGLE_MAPS_API_KEY` (API): restricción IP/servidor, **no** solo HTTP referrer.

Clasificación previa: key unrestricted → rotar/restringir en Google (externo).

---

## 6. Apple Sign In Web (sin cambios Apple aquí)

| Campo | Valor |
|-------|-------|
| SERVICE_ID_EXPECTED | EXTERNAL_INFO_REQUIRED — placeholder `APPLE_WEB_CLIENT_ID=REEMPLAZAR_CON_SERVICES_ID_WEB`; ejemplo docs `cl.rapago.app.web` (no confirmado en Apple) |
| RETURN_URL_STAGING | `https://backend.rapago.cl/auth/apple/web/callback` (mismo callback backend) |
| RETURN_URL_PROD | `https://backend.rapago.cl/auth/apple/web/callback` |
| DOMAIN_ASSOCIATION_REQUIRED | YES — verificar dominio(s) del Services ID (`staging.rapago.cl` / `app.rapago.cl` / legacy `api.rapago.cl`) + archivo Apple en host del dominio |
| BACKEND_CALLBACK | CODE_READY — `/auth/apple/web/start|callback`, `/api/auth/apple/web/complete` |
| `APPLE_WEB_FRONTEND_URL` staging | `https://staging.rapago.cl` |
| `APPLE_WEB_FRONTEND_URL` prod propuesto | `https://app.rapago.cl` |

Native App ID `cl.rapago.app` ≠ Services ID web.

---

## 7. Klap (sin cambios Klap aquí)

Separar **return FE** vs **webhook BE**:

| | URL |
|--|-----|
| STAGING_RETURN_URL | `https://staging.rapago.cl/passenger/trips?payment=return` |
| STAGING_CANCEL_URL | `https://staging.rapago.cl/passenger/trips?payment=failure_return` |
| PRODUCTION_RETURN_URL (actual docs) | `https://api.rapago.cl/passenger/trips?payment=return` |
| PRODUCTION_RETURN_URL (propuesto app) | `https://app.rapago.cl/passenger/trips?payment=return` |
| PRODUCTION_CANCEL (actual) | `https://api.rapago.cl/passenger/trips?payment=failure_return` |
| WEBHOOK confirm | `https://backend.rapago.cl/api/webhooks/klap/confirm` |
| WEBHOOK reject | `https://backend.rapago.cl/api/webhooks/klap/reject` |
| WEBHOOK validate | `https://backend.rapago.cl/api/webhooks/klap/validate` |

Sandbox orders/script: `.env.example` / staging template.  
`KLAP_EXTERNAL_BLOCKER`: confirmar con soporte/comercio que return URLs staging estén autorizadas en sandbox; webhooks siguen en `backend.rapago.cl`.

---

## 8. DB staging (diseño only — NO crear)

1. **Proyecto/DB PostgreSQL separado** (Supabase staging u otro) — nunca `DATABASE_URL` de producción.
2. Aplicar cadena:
   - `npm run db:migrate` / `migrate:prod` → journal drizzle hasta `0047_ride_requests_perf_indexes` (`meta/_journal.json`).
   - Luego manual `0056 → 0057_comfort → 0058` (`db:migrate:manual` / cola de `migrate:prod`).
3. **Huérfanos** `0044–0046`, `0048–0055` (y `0057_application_vehicle_category.sql`): documentados en `KNOWN_ORPHAN_SQL_OUTSIDE_CHAIN` — **no** auto-aplicados. Staging vacío puede necesitar precheck/ops para features que dependan de esos SQL (legales, OAuth Google enable, receipts, Klap capture, etc.).
4. Seed mínimo: `migrate:prod` inserta fare/legal mínimos; opcional `seed:dev` solo en staging (nunca prod data).
5. Rollback: snapshot/PITR del proyecto staging; no “down” automático drizzle para toda la cola.
6. `PRODUCTION_STATE=UNKNOWN` (no inspeccionar prod).

---

## 9. Migrations — verificación de cadena

| Check | Resultado |
|-------|-----------|
| Archivos `0000`…`0058` en disco | Sí (números 0–58 presentes; hay duplicados de número: 16–19, 27–37, 50, 57) |
| `_journal.json` latest | `0047_ride_requests_perf_indexes` — **no** incluye 0058 |
| Tail manual | `0056_vehicle_categories` → `0057_comfort_vehicle_category` → `0058_vehicle_capabilities` |
| Cert local script | `apps/api/scripts/cert-migration-0056-0058-local.sh` (aislada, no es DB vacía full) |
| Cert Fase 4 full chain | `rapago_web_staging_cert` + `npm run migrate:prod -w @rapa-go/api` ×2 — **PASS** (2026-08-25) |
| MIGRATION_CHAIN_READY | **PASS** (journal 0000–0047 + manual 0056–0058 en DB vacía local); huérfanos 0044–0055 siguen fuera de auto-apply |
| LATEST | `0058` |
| PRODUCTION_STATE | UNKNOWN |

No corrido contra DB vacía en esta fase; no prod.

---

## 10. Build staging (Fase 4 — mode=staging aislado)

Vite carga env por modo (`apps/mobile/vite.config.ts`):

| Modo | Archivos env (precedencia: `.local` > base) | Script |
|------|-----------------------------------------------|--------|
| `development` | `.env`, `.env.local`, `.env.development`, `.env.development.local` | `npm run dev -w @rapa-go/mobile` |
| `staging` | `.env`, `.env.local`, `.env.staging`, `.env.staging.local` | `npm run build:staging -w @rapa-go/mobile` |
| `production` | `.env`, `.env.local`, `.env.production`, `.env.production.local` | `npm run build:prod -w @rapa-go/mobile` |

**No** copiar `.env.production` como `.env.staging`. Usar plantilla:

```bash
cp apps/mobile/.env.staging.template apps/mobile/.env.staging
# Completar VITE_GOOGLE_* en el host de build (sin secretos de servidor).
```

### Sourcemaps

| Modo | `dist/*.map` públicos | Notas |
|------|----------------------|-------|
| dev | N/A (no emite a dist) | Servidos por Vite en dev |
| staging | **ON** (default) | QA/debug; desactivar con `VITE_STAGING_SOURCEMAPS=false` en `.env.staging.local` |
| production | **OFF** | `sourcemap: false` — nunca publicar `.map` junto al SPA |

### Guards de build (fail-fast)

- `mode=staging` + cualquier `VITE_*` contiene `app.rapago.cl` → **FAIL**
- `mode=production` + cualquier `VITE_*` contiene `staging.rapago.cl` → **FAIL**
- `mode=staging` requiere `VITE_ENV=staging` y API `backend.rapago.cl`

### Comandos

```bash
cd /path/to/Rapa_Go_WebPhase1_20260825
npm run build -w @rapa-go/shared
npm run build:staging -w @rapa-go/mobile   # staging SPA → apps/mobile/dist
npm run build:prod -w @rapa-go/mobile      # production SPA
```

| Campo | Valor |
|-------|-------|
| STAGING_BUILD_COMMAND | `npm run build:staging -w @rapa-go/mobile` |
| STAGING_ENV_FILE | `apps/mobile/.env.staging` (desde `.env.staging.template`) |
| PRODUCTION_BUILD_COMMAND | `npm run build:prod -w @rapa-go/mobile` |
| OUTPUT_DIR | `apps/mobile/dist` |
| STAGING_API_HOST | `https://backend.rapago.cl/api` |
| STAGING_FRONTEND_HOST | `https://staging.rapago.cl` (DNS/hosting externo) |
| STAGING_SOURCEMAPS | ON (QA default) |
| PRODUCTION_SOURCEMAPS | OFF |

---

## 10b. Variables VITE por ambiente (sin secretos backend)

| Variable | dev | staging | production |
|----------|-----|---------|------------|
| `VITE_ENV` | `development` | `staging` | `production` |
| `VITE_API_BASE_URL` | `/api` (proxy Vite) | `https://backend.rapago.cl/api` | `https://backend.rapago.cl/api` |
| `VITE_GOOGLE_MAPS_API_KEY` | local (referrers localhost) | clave browser, referrer `https://staging.rapago.cl/*` | referrer `https://app.rapago.cl/*` |
| `VITE_GOOGLE_WEB_CLIENT_ID` | dev client | staging web client | prod web client |
| `VITE_KLAP_ELEMENTS_ENABLED` | `false` | `false` (sandbox opcional) | según release |
| `VITE_KLAP_CHECKOUT_FLEX_SCRIPT_URL` | sandbox URL | sandbox URL | prod Klap URL |
| `VITE_FEATURE_*` | `false` | `false` | según flags |

Backend (no `VITE_`): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_*` server, `APPLE_*`, `KLAP_*` webhooks/secrets — solo en `apps/api/.env`.

---

## 10c. Migraciones staging DB (temp / cert local)

**Nunca** apuntar a Supabase/Hostinger prod. Certificación Fase 4:

```bash
# DB aislada local
DB=rapago_web_staging_cert
dropdb --if-exists "$DB" && createdb "$DB"
export DATABASE_URL="postgresql://$(whoami)@127.0.0.1:5432/$DB"
export DIRECT_URL="$DATABASE_URL"

# Cadena real del repo (journal drizzle + manual 0056→0057→0058 + seed mínimo)
npm run migrate:prod -w @rapa-go/api

# Idempotencia: repetir migrate:prod — manual chain debe skip con checksum ok
npm run migrate:prod -w @rapa-go/api
```

Evidencia Fase 4 (2026-08-25): cadena vacía→0058 **PASS** en `rapago_web_staging_cert`; segunda corrida **PASS** (skips idempotentes).

**PARTIAL root cause (cadena documentada):** `JOURNAL_GAP` — `_journal.json` termina en `0047`; archivos `0044–0046`, `0048–0055`, `0057_application_*` son huérfanos fuera de journal y fuera del manifest manual (`KNOWN_ORPHAN_SQL_OUTSIDE_CHAIN`). Tail producto `0056→0057_comfort→0058` vía `migrate:prod` / `applyManualMigrations`.

---

## 10d. Seed plan staging (sin PII prod)

Tras `migrate:prod` ya existen inserts idempotentes:

- `fare_settings`: al menos `mobility_per_km` (230000 CLP)
- `legal_documents`: placeholder `terms_and_conditions` v1.0.0 inactivo

Staging adicional recomendado (ops, no prod data):

- `fare_settings`: filas `comfort_fare_multiplier_bps`, `comfort_min_vehicle_year` (viene de 0057 si manual chain aplicada)
- Usuarios/driver de prueba: `npm run seed:dev -w @rapa-go/api` **solo** en DB staging
- Sin copiar usuarios, pagos ni tokens de producción

---

## 11. Checklist externo

- [ ] DNS `staging.rapago.cl` (A/CNAME + target confirmado en Hostinger/DNS)
- [ ] SSL válido en `staging.rapago.cl`
- [ ] Crear/public root Hostinger + SPA fallback `index.html`
- [ ] Build staging (`npm run build:staging -w @rapa-go/mobile` + `.env.staging`) → subir `dist/`
- [ ] Vars VITE_* de staging en el artefacto de build
- [ ] CORS backend Hostinger incluye `https://staging.rapago.cl`
- [ ] Google OAuth: JS origin `https://staging.rapago.cl` (+ `https://app.rapago.cl` para prod)
- [ ] Maps: referrers `https://staging.rapago.cl/*` y `https://app.rapago.cl/*`; APIs JS/Places/Geocoding/(Directions); Static+Directions en key servidor
- [ ] Apple: Services ID + Return URL backend + domain association + `APPLE_WEB_FRONTEND_URL`
- [ ] Klap sandbox: return/cancel staging; webhooks en `backend.rapago.cl`
- [ ] DB staging separada (sin datos prod)
- [ ] Migraciones journal→0047 + manual 0056–0058 (+ plan huérfanos si hace falta)
- [ ] Smoke test: carga SPA, CORS/API health, Maps, login Google/Apple (si listo), pago sandbox opcional

---

## 12. Bloqueantes (clasificación)

| Clase | Ítems |
|-------|--------|
| CAN_CONFIGURE_WITH_REPO_ONLY | Matriz env, URLs propuestas, CORS mecanismo, build command, checklist docs, diseño DB |
| REQUIRES_HOSTINGER_ACCESS | DNS/subdominio, SSL, `public_html`, upload `dist`, env Node `CORS_ORIGIN` / Klap / Apple FE URL |
| REQUIRES_GOOGLE_ACCESS | OAuth JS origins, Maps referrers + enable APIs, rotación key si unrestricted |
| REQUIRES_APPLE_ACCESS | Services ID, Return URLs, domain verify, keys Team/Key si faltan |
| REQUIRES_KLAP_SUPPORT | Autorizar return URLs staging en sandbox; confirmar webhooks |
| REQUIRES_DB_ACCESS | Crear proyecto staging, `DATABASE_URL`, correr migraciones, seed mínimo |

---

## 13. Report snapshot

Ver bloque final en chat / sección siguiente del mismo documento.

```
=== WEB STAGING CONFIG PLAN ===

DNS_REQUIRED=YES
SSL_REQUIRED=YES
HOSTING_TARGET_KNOWN=PARTIAL

STAGING_FRONTEND_URL=https://staging.rapago.cl
STAGING_API_URL=https://backend.rapago.cl/api

CORS_CHANGE_REQUIRED=YES

GOOGLE_ORIGIN=https://staging.rapago.cl (+ https://app.rapago.cl prod)
GOOGLE_REDIRECT=N/A_GIS_ID_TOKEN (console may still require placeholder HTTPS origin)

MAPS_REFERRERS=https://staging.rapago.cl/* ; https://app.rapago.cl/* (; https://api.rapago.cl/* legacy)
MAPS_APIS=Maps JavaScript API, Places API, Geocoding API, Directions API; Maps Static API (server)

APPLE_SERVICE_ID=EXTERNAL_INFO_REQUIRED
APPLE_RETURN_STAGING=https://backend.rapago.cl/auth/apple/web/callback
APPLE_RETURN_PROD=https://backend.rapago.cl/auth/apple/web/callback
APPLE_EXTERNAL_BLOCKER=YES (Services ID + domain association + APPLE_WEB_* en Hostinger)

KLAP_RETURN_STAGING=https://staging.rapago.cl/passenger/trips?payment=return
KLAP_RETURN_PROD=https://app.rapago.cl/passenger/trips?payment=return (propuesto; actual docs api.rapago.cl)
KLAP_WEBHOOK=https://backend.rapago.cl/api/webhooks/klap/confirm (+ reject/validate)
KLAP_EXTERNAL_BLOCKER=YES (autorizar return staging en sandbox)

STAGING_DATABASE_REQUIRED=YES
MIGRATION_CHAIN_READY=PASS_LOCAL_CERT
LATEST_MIGRATION=0058

STAGING_BUILD_COMMAND=npm run build:staging -w @rapa-go/mobile
PRODUCTION_BUILD_COMMAND=npm run build:prod -w @rapa-go/mobile
OUTPUT_DIR=apps/mobile/dist

EXTERNAL_INFO_REQUIRED=DNS A/CNAME+TTL target staging; Hostinger public_html path; live CORS_ORIGIN; Apple Services ID; confirm Klap sandbox return allowlist; staging DB credentials; production migration state

READY_TO_CONFIGURE_EXTERNAL_SERVICES=YES_WITH_CHECKLIST
READY_TO_DEPLOY_STAGING=NO

NO_CODE_CHANGED=NO
NO_EXTERNAL_CHANGES=YES
NO_COMMIT=YES
NO_PUSH=YES
NO_DEPLOY=YES
```
