# Validaciones del paquete corregido

Fecha: 23 de julio de 2026.

## Ejecutadas en el entorno de empaquetado

- Análisis sintáctico de 447 archivos TypeScript/TSX: **OK**.
- `node scripts/release/verify-release.mjs`: **OK**.
- `node scripts/release/verify-routes.mjs`: **OK**.

## Deben ejecutarse en el equipo del propietario

El entorno de empaquetado no tuvo acceso al registro npm para reinstalar dependencias. Por eso el ZIP incluye:

`scripts/release/prepare-production-release.ps1`

Ese script ejecuta `npm ci`, typecheck, pruebas, builds, verificadores y crea evidencia con hashes. El release no debe desplegarse si cualquiera de esos pasos falla.
