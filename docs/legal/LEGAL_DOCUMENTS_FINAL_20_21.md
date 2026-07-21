# Documentos legales definitivos — puntos 20 y 21

## Condiciones para Usuarios

“Condiciones para Usuarios” se mantiene como documento legal independiente y versionado cuando contiene reglas operacionales específicas para pasajeros, conductores u otros usuarios de la plataforma. No reemplaza los Términos y Condiciones generales ni la Política de Privacidad.

Cada documento debe tener:

- tipo legal único;
- versión visible;
- fecha de vigencia;
- contenido no vacío;
- estado activo o inactivo;
- registro de aceptación cuando sea obligatorio;
- una sola versión activa por tipo.

## Documentos obligatorios

La plataforma administra versiones definitivas para:

- Términos y Condiciones;
- Política de Privacidad;
- Condiciones para Usuarios;
- condiciones aplicables a conductores;
- reglas de cancelación y no presentación;
- condiciones de pagos y beneficios;
- eliminación de cuenta;
- soporte y reclamos;
- licencia informativa de la aplicación.

## Prohibiciones

No puede publicarse como activo un documento que:

- esté vacío;
- diga “documento en preparación” o una expresión equivalente;
- utilice una versión o fecha inválida;
- contradiga otro documento activo sin haber desactivado la versión anterior.

La interfaz pública muestra un mensaje de indisponibilidad temporal cuando no existe una versión publicada, sin presentar contenido ficticio como si fuera un contrato aceptable.

## Evidencia técnica

- Validación: `apps/api/src/modules/legal/legal.schemas.ts`.
- Persistencia y desactivación de versiones previas: `apps/api/src/modules/legal/legal.repository.ts`.
- Publicación y lectura: `apps/api/src/modules/legal/legal.controller.ts`.
- Contenido de respaldo no contractual: `apps/mobile/src/pages/public/legalFallbackContent.ts`.
- Migración de versiones definitivas: `apps/api/src/db/migrations/0038_final_matrix_19_24.sql`.

**Estado del punto 20:** completado.

**Estado del punto 21:** completado.
