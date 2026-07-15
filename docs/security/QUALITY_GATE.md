# Quality Gate — `.github/workflows/quality-gate.yml`

Control automático de Pull Requests hacia `main`. No publica, no despliega, no toca release de
Android/iOS ni Sentry — esos son componentes separados, fuera del alcance de este workflow.

## Jobs

| Job (id) | Qué valida |
|---|---|
| `install` | `npm ci` en la raíz (instalación reproducible desde `package-lock.json`), cachea `node_modules` para los demás jobs |
| `typecheck` | `tsc --noEmit` en `apps/api` y `apps/mobile` |
| `test-api` | Suite completa de Vitest de `apps/api` |
| `build` | Build de `packages/shared` → `apps/api` → `apps/mobile` |
| `migrations` | `npm run db:verify-chain` contra un servicio `postgres:16` efímero: migra una base vacía desde cero y confirma que una segunda ejecución no cambia el schema |
| `secret-scan` | `gitleaks/gitleaks-action@v2` sobre el diff del PR |
| `financial-authz-regression` | Corre aislada la suite bajo `src/modules/{payments,wallet,rides}` y falla si el número de archivos `*.test.ts` en esas rutas bajó respecto a `main` (evita "resolver" un fallo borrando el test) |
| `quality-gate-report` | `if: always()`, agrega un resumen en `$GITHUB_STEP_SUMMARY` y falla si cualquiera de los jobs anteriores falló o fue cancelado — es el único check que se marca como obligatorio en la protección de rama |

## Nota sobre Gitleaks

`gitleaks/gitleaks-action@v2` es gratuita para repositorios públicos y cuentas personales. Si este
repositorio pasa a vivir bajo una **organización** de GitHub, Gitleaks puede exigir la variable
`GITLEAKS_LICENSE` para seguir funcionando — no se agregó ninguna licencia ni secreto en este
cambio. Si el job `secret-scan` falla específicamente por falta de licencia (no por secretos
detectados), se reemplaza en un commit separado por una alternativa sin dependencia comercial. No
se reemplaza preventivamente por reglas regex propias: una búsqueda regex casera típicamente
detecta menos patrones de secretos reales que una herramienta dedicada.

## Configuración manual pendiente en GitHub (no se puede aplicar desde este repositorio)

Para que el Quality Gate bloquee efectivamente el merge a `main`, hay que configurar en GitHub:

```text
Settings → Branches (o Rulesets) → main
  ✅ Require a pull request before merging
  ✅ Require status checks to pass
      Status check obligatorio: quality-gate-report
  ✅ Block force pushes
  ✅ Block deletions
```

Sin esta configuración, el workflow corre y reporta en cada PR, pero **no impide el merge** —
solo lo marca visualmente como fallido.

## Fuera de alcance de este workflow

- Publicación/release automática (Android/iOS) — `release-validation.yml`, componente separado
  pendiente.
- Observabilidad — integración de Sentry (API + móvil), componente separado pendiente.
- Lint (`eslint`) — no estaba en el alcance pedido para este Quality Gate; puede agregarse en un
  cambio posterior si se solicita.
- Aplicación de migraciones a `rapago` (dev real), staging o producción — el job `migrations`
  usa exclusivamente una base efímera del propio job de CI, nunca `DATABASE_URL` del proyecto.
