# RAPA GO — Web marcha blanca pasajero (Phase 1 readiness)

> **Update 2026-08-25:** True isolation → `docs/release/TRUE_STAGING_ISOLATION_RUNBOOK_20260825.md`.
> Staging FE API = `https://backend-staging.rapago.cl/api` (no `backend.rapago.cl`).

Fecha: 2026-08-25  
Base: `origin/main`  
Ámbito: preparación local (docs/config). **Sin** deploy, DNS, Google Console, Apple Developer, migraciones prod ni pagos reales.

## Variables web (STAGING / PRODUCTION) — sin secretos

Solo `VITE_*` en el bundle del SPA. Secretos de servidor **nunca** con prefijo `VITE_`.

| Variable | Staging | Production | Notas |
|----------|---------|------------|-------|
| `VITE_API_BASE_URL` / `VITE_API_URL` | `https://backend-staging.rapago.cl/api` | `https://backend.rapago.cl/api` | Vite guard falla si staging apunta a prod |
| `VITE_ENV` | `staging` | `production` | |
| `VITE_GOOGLE_MAPS_API_KEY` | clave browser + referrer `https://staging.rapago.cl/*` | referrers `https://app.rapago.cl/*` (+ `https://api.rapago.cl/*` hasta cutover) | Rotar si estuvo en Git sin restricción |
| `VITE_GOOGLE_WEB_CLIENT_ID` | OAuth Web Client | mismo o cliente dedicado | Orígenes JS en Google Console |
| `VITE_KLAP_*` | script sandbox + flag | script prod + flag | Return/webhook en backend-staging |
| Apple web | N/A en VITE_ | N/A en VITE_ | Backend staging: `APPLE_WEB_*` → backend-staging |

Plantillas: `apps/mobile/.env.example`, `.env.template`, `.env.staging.template`, `.env.production.template`; API staging: `apps/api/.env.staging.template`.

## Hostnames (evidencia código/docs; sin DNS)

| HOST | USO_ACTUAL | USO_PROPUESTO | CAMBIO_NECESARIO |
|------|------------|---------------|------------------|
| `api.rapago.cl` | Frontend SPA + legales (`docs/release/PRODUCTION_TECHNICAL_CLOSURE.md`, carpeta Hostinger `domains/api.rapago.cl/public_html`) | Mantener legales/legacy o redirigir a `app.rapago.cl` | Cutover DNS/hosting externo |
| `backend.rapago.cl` | API Node (`VITE_API_BASE_URL`, webhooks Klap) | Sin cambio | No |
| `app.rapago.cl` | No documentado como host activo del SPA | Frontend pasajero (marcha blanca / white-label) | Sí — DNS/SSL/dist (externo) |
| `staging.rapago.cl` | Mencionado en docs de ambiente; no confirmado desplegado | SPA staging | Sí — DNS/SSL/dist (externo) |

## Google Login web (GIS — id_token)

Flujo: `VITE_GOOGLE_WEB_CLIENT_ID` + Google Identity Services (`accounts.id`), sin redirect OAuth clásico.

**AUTHORIZED_JAVASCRIPT_ORIGINS (exactos):**
- `https://staging.rapago.cl`
- `https://app.rapago.cl`
- (actual hasta cutover) `https://api.rapago.cl`
- (dev) `http://localhost:5173`

**REDIRECT_URIS:** no usados por el flujo GIS credential/id_token actual. Si la consola exige al menos uno, registrar los mismos orígenes HTTPS o dejar el set vacío según política del cliente Web. **No** apuntar redirect al SPA path de login salvo que se cambie el código a auth-code.

Cambios: solo Google Cloud Console (externo).

## Apple Login web

Código listo: `APPLE_WEB_*` + rutas `/auth/apple/web/start|callback` y `/api/auth/apple/web/complete`.

| Ítem | Valor propuesto | Estado |
|------|-----------------|--------|
| Services ID | valor de `APPLE_WEB_CLIENT_ID` (también en `APPLE_ALLOWED_CLIENT_IDS`) | EXTERNAL_CONFIG_REQUIRED |
| Return URL | `https://backend.rapago.cl/auth/apple/web/callback` | EXTERNAL_CONFIG_REQUIRED |
| Dominio Services ID | `staging.rapago.cl` / `app.rapago.cl` (+ `api.rapago.cl` actual) | EXTERNAL_CONFIG_REQUIRED |
| Domain verification | archivo Apple en el host del dominio del Services ID | EXTERNAL_CONFIG_REQUIRED |
| Backend callback | ya implementado | CODE_READY |
| `APPLE_WEB_FRONTEND_URL` | `https://staging.rapago.cl` o `https://app.rapago.cl` | EXTERNAL_CONFIG_REQUIRED |

## Klap web

| | URL |
|--|-----|
| STAGING_RETURN_URL | `https://staging.rapago.cl/passenger/trips?payment=return` |
| PRODUCTION_RETURN_URL (actual docs) | `https://api.rapago.cl/passenger/trips?payment=return` |
| PRODUCTION_RETURN_URL (propuesto app) | `https://app.rapago.cl/passenger/trips?payment=return` |
| WEBHOOK_URL (confirm) | `https://backend.rapago.cl/api/webhooks/klap/confirm` |
| WEBHOOK reject/validate | `…/reject`, `…/validate` en el mismo host backend |

Los webhooks pegan al **backend**, no al SPA (`payments.routes.ts`, `.env.example`). Cancel: `…?payment=failure_return` en el mismo host de return.

## Sourcemaps

- Dev: sourcemaps de Vite server intactos.
- Prod build: `build.sourcemap: false` → no se publican `.map` si se copia `dist/`.

## Staging checklist (NO ejecutar aquí)

- [ ] DNS `staging.rapago.cl` → host estático
- [ ] SSL válido
- [ ] Publicar `apps/mobile/dist` (build production/staging)
- [ ] SPA fallback → `index.html`
- [ ] Vars `VITE_*` de staging
- [ ] CORS backend incluye `https://staging.rapago.cl`
- [ ] Google JS origin `https://staging.rapago.cl`
- [ ] Apple return + `APPLE_WEB_FRONTEND_URL=https://staging.rapago.cl`
- [ ] Maps referrer `https://staging.rapago.cl/*`
- [ ] Klap sandbox + return staging
- [ ] Sin migraciones prod / sin pagos reales en esta fase

## Rotación Maps (externo)

La plantilla `.env.template` contenía una clave `AIza…` real. Se reemplazó por placeholder. **Rotar y restringir en Google Cloud** (HTTP referrers arriba). No se modifica Google Cloud desde este repo.

## Fase 2 — Staging external config plan

Plan operativo (DNS/CORS/OAuth/Maps/Apple/Klap/DB/build/checklist) sin ejecutar externos:

→ [`WEB_STAGING_EXTERNAL_CONFIG_PLAN_20260825.md`](./WEB_STAGING_EXTERNAL_CONFIG_PLAN_20260825.md)

Resumen: `staging.rapago.cl` FE → API `backend.rapago.cl`; CORS env debe añadir staging (no está en defaults de `cors.ts`); Maps referrers staging+app; Apple/Klap EXTERNAL; DB staging separada; migraciones journal→0047 + manual 0056–0058; `READY_TO_DEPLOY_STAGING=NO`.

