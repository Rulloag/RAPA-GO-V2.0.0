# Definition of Done — RAPA GO V2.0.0

Un módulo, pantalla, endpoint o feature está **Done** cuando cumple TODOS los criterios de su categoría.

---

## Pantalla / Componente (Mobile)

- [ ] Tiene ruta definida en el router (no es una pantalla huérfana).
- [ ] El componente está tipado con TypeScript. Sin `any` no justificado.
- [ ] Los datos se obtienen del backend via un servicio real. No hay datos hardcodeados.
- [ ] Implementa estado de **carga** (skeleton o spinner visible mientras espera respuesta).
- [ ] Implementa estado de **error** (mensaje de error legible y botón de reintento cuando aplica).
- [ ] Implementa estado **vacío** cuando no hay datos que mostrar.
- [ ] Si captura input del usuario, valida con Zod antes de enviar al backend.
- [ ] Los botones tienen estado `disabled` mientras se procesa una acción.
- [ ] No usa `localStorage` para datos críticos.
- [ ] Fue probado en un dispositivo o emulador (no solo en el navegador de desarrollo).

---

## Endpoint de API (Backend)

- [ ] La ruta está registrada en Fastify con prefijo correcto.
- [ ] El schema de request se valida con Zod. Entrada inválida devuelve `400` con detalle.
- [ ] La autenticación se verifica si la ruta es protegida.
- [ ] La autorización de rol se verifica si la ruta requiere un rol específico.
- [ ] La lógica de negocio vive en un servicio, no directamente en el handler.
- [ ] Las operaciones de base de datos críticas usan transacciones.
- [ ] Los errores devuelven el formato de error estándar del proyecto.
- [ ] No hay secretos ni credenciales hardcodeadas.
- [ ] Fue probado manualmente con una herramienta HTTP (curl, Insomnia, Postman).

---

## Módulo completo

- [ ] El flujo completo del usuario está implementado y funcional de extremo a extremo.
- [ ] Mobile ↔ Backend ↔ Base de datos funciona con datos reales.
- [ ] El estado de tiempo real (si aplica) se actualiza via Realtime sin recargar.
- [ ] Los flujos de error son visibles y recuperables para el usuario.
- [ ] El módulo fue probado en el ambiente de staging.
- [ ] La documentación del módulo en `docs/product/` refleja el comportamiento real implementado.

---

## Feature de pago o wallet

Aplica todo lo anterior más:
- [ ] El flujo de pago es completamente server-side. El cliente nunca procesa ni confirma el pago.
- [ ] El webhook del proveedor fue probado (con herramienta de simulación o en sandbox).
- [ ] La idempotencia del webhook fue verificada (procesar dos veces no duplica transacciones).
- [ ] El saldo del wallet se actualiza después del webhook, no antes.
- [ ] El flujo de error de pago (pago rechazado, timeout) muestra mensaje claro al usuario.

---

## Criterio general: no hay "solo visual"

**Un módulo que solo muestra datos hardcodeados o una pantalla sin conexión al backend no está Done.**

No se considera completo si:
- Los datos son estáticos o hardcodeados.
- Los botones no tienen acción implementada.
- No hay manejo de errores.
- No hay conexión real al backend.
- Solo funciona en happy path (sin flujos de error).
