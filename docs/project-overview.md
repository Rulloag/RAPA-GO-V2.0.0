# Visión General del Proyecto — RAPA GO V2.0.0

## Descripción

RAPA GO es una plataforma móvil de servicios de movilidad y turismo diseñada exclusivamente para Rapa Nui (Isla de Pascua), Chile. La versión 2.0.0 es una reescritura completa con arquitectura segura, backend real, pagos en línea y capacidades de tiempo real.

## Contexto geográfico y operacional

Rapa Nui es una isla con características únicas de movilidad:
- Territorio acotado con rutas terrestres limitadas.
- Alta dependencia del turismo nacional e internacional.
- Necesidad de servicios de transporte regulados.
- Economía con operadores locales independientes (conductores, guías, agencias).

## Problema que resuelve

Hoy en día no existe una plataforma unificada para:
- Solicitar transporte en tiempo real.
- Contratar guías turísticos certificados.
- Reservar vehículos (rent a car) de operadores locales.
- Gestionar pagos electrónicos seguros en contexto chileno.
- Permitir a operadores y administradores gestionar su operación en tiempo real.

## Propuesta de valor

RAPA GO centraliza todos estos servicios en una sola app móvil nativa para Android e iOS, con:
- Experiencia de usuario similar a Uber para transporte.
- Integración con Google Maps.
- Wallet digital para pasajeros y operadores.
- Pagos en línea con proveedores chilenos (Flow, Transbank, MercadoPago).
- Panel de administración para fiscalización y aprobación de operadores.

## Usuarios objetivo

| Rol | Descripción |
|-----|-------------|
| Pasajero | Persona que solicita transporte, guía o vehículo. |
| Conductor | Operador de transporte que acepta solicitudes. |
| Guía turístico | Profesional que ofrece tours y servicios guiados. |
| Operador Rent a Car | Empresa o persona que arrienda vehículos. |
| Administrador | Equipo RAPA GO que gestiona, aprueba y fiscaliza. |

## Alcance de V2.0.0

### Incluido
- App mobile Android e iOS (Ionic React + Capacitor).
- Backend API (Fastify + TypeScript).
- Base de datos PostgreSQL (Supabase).
- Autenticación segura.
- Módulo de transporte (matching, viajes en tiempo real).
- Módulo de guías turísticos.
- Módulo de rent a car.
- Wallet digital.
- Pagos en línea.
- Google Maps integrado.
- Panel de administración.
- Notificaciones push.

### Fuera de alcance V2.0.0
- Versión web para usuarios finales.
- Integración con sistemas municipales.
- Módulo de logística de carga.
- Programa de fidelización.

## Stack tecnológico definido

| Capa | Tecnología |
|------|-----------|
| Mobile | Ionic React + Capacitor + TypeScript |
| Backend | Fastify + TypeScript |
| Base de datos | PostgreSQL via Supabase |
| Autenticación | Supabase Auth / JWT backend |
| Tiempo real | Supabase Realtime / WebSocket |
| Mapas | Google Maps SDK/API |
| Pagos | Abstracción PaymentProvider (Flow/Transbank/MercadoPago) |
| Validación | Zod |

## Principios no negociables

1. El backend es la única fuente de verdad.
2. Ningún flujo crítico depende de `localStorage`.
3. Los pagos se procesan exclusivamente server-side.
4. Ningún módulo está completo si es solo visual.

Ver `PROJECT_RULES.md` para la lista completa de reglas obligatorias.
