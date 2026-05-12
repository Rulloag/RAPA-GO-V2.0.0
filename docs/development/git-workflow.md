# Git Workflow — RAPA GO V2.0.0

## Rama principal

- `main`: rama estable y desplegable en todo momento. Nadie hace push directo a `main`.

## Ramas de trabajo

| Tipo | Prefijo | Ejemplo |
|------|---------|---------|
| Feature | `feat/` | `feat/auth-login` |
| Bug fix | `fix/` | `fix/wallet-balance-display` |
| Documentación | `docs/` | `docs/architecture-update` |
| Refactor | `refactor/` | `refactor/payment-provider` |
| Configuración | `chore/` | `chore/eslint-setup` |
| Hotfix crítico | `hotfix/` | `hotfix/payment-webhook-crash` |

## Flujo estándar

```
1. Crear rama desde main actualizado:
   git checkout main && git pull
   git checkout -b feat/nombre-del-feature

2. Desarrollar en commits pequeños y descriptivos.

3. Abrir Pull Request a main cuando la feature esté lista.

4. Code review (al menos 1 aprobación).

5. Merge via squash o merge commit (según el tamaño del PR).

6. Eliminar la rama después del merge.
```

## Mensajes de commit

Seguir **Conventional Commits**:

```
<tipo>[scope opcional]: <descripción corta>

[cuerpo opcional]
```

### Tipos válidos

| Tipo | Cuándo usar |
|------|------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo cambios de documentación |
| `refactor` | Refactor sin cambio de comportamiento |
| `test` | Agregar o corregir tests |
| `chore` | Configuración, dependencias, CI/CD |
| `perf` | Mejora de rendimiento |

### Prefijos de scope sugeridos

- `[mobile]`: cambios en la app mobile.
- `[backend]`: cambios en el backend.
- `[shared]`: cambios en código compartido.
- `[docs]`: cambios en documentación.
- `[infra]`: cambios de infraestructura/CI.

### Ejemplos

```
feat[backend]: add trip matching endpoint
fix[mobile]: show error state when wallet fetch fails
docs: add wallet flow documentation
chore[backend]: configure eslint and prettier
```

## Pull Requests

- **Título**: descriptivo, formato Conventional Commits.
- **Descripción**: qué se cambió, por qué, cómo testearlo.
- **Tamaño**: máximo un módulo por PR. PRs grandes se dividen.
- **No mezclar**: documentación + código + refactor en el mismo PR, salvo que sean inseparables.

## Tags y versiones

- Las versiones de release se etiquetan con semver: `v2.0.0`, `v2.1.0`.
- Los tags solo se crean en `main` después de una release validada.

## Protecciones de rama (configurar en GitHub/GitLab)

- `main` requiere PR aprobado para recibir cambios.
- No se permiten force push en `main`.
- CI debe pasar antes de hacer merge.
