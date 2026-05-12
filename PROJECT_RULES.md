# PROJECT_RULES.md — RAPA GO V2.0.0

> Estas reglas son de cumplimiento obligatorio para todos los agentes, desarrolladores y colaboradores del proyecto.
> Ninguna regla puede ser omitida sin aprobación explícita del arquitecto principal.

---

## 1. Reglas de Arquitectura

- **R-ARCH-01**: Toda lógica crítica de negocio debe vivir en el backend o en la base de datos. Ningún cliente (mobile, web) es fuente de verdad.
- **R-ARCH-02**: El backend es la única fuente de verdad para: wallet, viajes, pagos, matching, ubicación, reservas y aprobaciones administrativas.
- **R-ARCH-03**: La arquitectura es monorepo. Las apps mobile, backend y shared se organizan bajo un único repositorio versionado.
- **R-ARCH-04**: Cada módulo debe tener su propia capa de servicio en backend antes de ser expuesto al cliente.

---

## 2. Reglas de Almacenamiento del Cliente

- **R-STORE-01**: `localStorage` está prohibido para flujos críticos. Nunca almacenar: tokens de sesión activa, saldos de wallet, estado de viajes, datos de pago, matching o aprobaciones.
- **R-STORE-02**: `localStorage` solo puede usarse para preferencias de interfaz no críticas: tema (claro/oscuro), idioma seleccionado, preferencias de UI locales.
- **R-STORE-03**: El estado de sesión del usuario se gestiona mediante tokens seguros (JWT o Supabase Auth) controlados desde el backend.

---

## 3. Reglas de Stack Tecnológico

- **R-STACK-01 (Mobile)**: Ionic React + Capacitor + TypeScript. Sin excepciones para la capa de presentación.
- **R-STACK-02 (Backend)**: Fastify + TypeScript. Toda API es REST o WebSocket. Sin Express ni otros frameworks sin aprobación.
- **R-STACK-03 (Database)**: PostgreSQL mediante Supabase. Sin bases de datos alternativas sin ADR aprobado.
- **R-STACK-04 (Real-time)**: Supabase Realtime o WebSocket gestionado desde backend. Sin polling de cliente como solución permanente.
- **R-STACK-05 (Maps)**: Google Maps SDK/API únicamente.
- **R-STACK-06 (Payments)**: Abstracción `PaymentProvider`. Proveedores compatibles: Flow, Transbank, MercadoPago. Nunca acoplar al proveedor directamente.
- **R-STACK-07 (Validation)**: Zod en frontend y backend para toda validación de esquemas.
- **R-STACK-08 (Auth)**: Supabase Auth o JWT seguro gestionado desde backend. Sin auth del lado del cliente.

---

## 4. Reglas de Desarrollo

- **R-DEV-01**: Ningún módulo se considera completo si es solo visual. Requiere: ruta real, validación, estado de carga, estado de error y conexión real al backend.
- **R-DEV-02**: Ningún botón se considera completo sin: acción definida, estado `disabled` mientras procesa y manejo de errores visible.
- **R-DEV-03**: Los cambios deben ser pequeños y revisables. Máximo un módulo por PR.
- **R-DEV-04**: No crear módulos demo, simulados, fake o con datos hardcodeados que imiten flujos reales.
- **R-DEV-05**: No crear wallet demo, matching simulado ni flujos de pago sin backend real.
- **R-DEV-06**: No sobrescribir archivos existentes sin leer su contenido primero.

---

## 5. Reglas de Calidad

- **R-QA-01**: Todo endpoint de backend debe tener validación de entrada con Zod y respuesta de error estructurada.
- **R-QA-02**: Todo flujo crítico (pago, viaje, reserva, wallet) debe tener manejo de errores explícito en frontend y backend.
- **R-QA-03**: Definition of Done debe cumplirse antes de marcar cualquier tarea como completada. Ver `docs/development/definition-of-done.md`.

---

## 6. Reglas de Seguridad

- **R-SEC-01**: Ningún secreto, API key o credencial puede estar en el código fuente ni en el cliente.
- **R-SEC-02**: Las variables de entorno sensibles solo residen en el backend. El cliente solo recibe tokens de acceso de vida corta.
- **R-SEC-03**: Las rutas administrativas deben requerir autenticación y autorización de rol en el backend. El frontend solo oculta UI, no protege datos.
- **R-SEC-04**: Los pagos deben procesarse exclusivamente server-side. Ningún flujo de pago puede completarse sin validación del backend.

---

## 7. Orden de trabajo

1. Documentación y arquitectura (fase actual).
2. Setup del monorepo y configuración de entorno.
3. Backend base (Fastify, Supabase, Auth).
4. Mobile base (Ionic React, Capacitor, navegación).
5. Módulos por orden de prioridad definida en `docs/product/modules.md`.

---

*Última actualización: 2026-05-11*
*Arquitecto principal: Rodrigo Alexander Ulloa González*
