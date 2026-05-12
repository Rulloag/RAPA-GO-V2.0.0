# Arquitectura Mobile — RAPA GO V2.0.0

## Stack

| Tecnología | Versión objetivo | Rol |
|-----------|-----------------|-----|
| Ionic React | 8.x | Framework de componentes UI mobile |
| Capacitor | 6.x | Bridge nativo Android/iOS |
| TypeScript | 5.x | Tipado estático |
| React | 18.x | Motor de renderizado |
| React Router | 6.x | Navegación entre pantallas |
| Zod | 3.x | Validación de esquemas y formularios |

## Estructura de carpetas (target)

```
mobile/
├── src/
│   ├── pages/           — Pantallas principales (una por ruta)
│   ├── components/      — Componentes reutilizables
│   ├── hooks/           — Custom hooks (useTrip, useWallet, useAuth...)
│   ├── services/        — Llamadas al backend (apiClient, supabaseClient)
│   ├── store/           — Estado global (React Context o Zustand)
│   ├── schemas/         — Esquemas Zod compartidos con backend
│   ├── types/           — Tipos TypeScript del dominio
│   └── utils/           — Helpers sin efectos secundarios
├── capacitor.config.ts
└── ionic.config.json
```

## Principios de la capa mobile

### Pantallas
Cada pantalla (`/pages`) debe implementar:
- Ruta definida en el router.
- Estado de carga (`isLoading`).
- Estado de error (`error`) con mensaje visible al usuario.
- Datos reales provenientes de un servicio (nunca hardcodeados).
- Validación con Zod si captura input del usuario.

### Servicios
La capa `/services` es el único lugar donde se hacen llamadas HTTP o suscripciones al backend. Las pantallas no llaman directamente a `fetch`.

### Estado global
El estado global (sesión del usuario, perfil) se gestiona mediante Context o Zustand. El estado de viajes activos, wallet y matching se solicita al backend en cada montaje o se actualiza via suscripción Realtime. No se almacena en `localStorage`.

### Navegación
- Rutas públicas: login, registro, onboarding.
- Rutas protegidas: requieren token válido verificado. El guard de ruta consulta el estado de sesión, no `localStorage`.
- Rutas de rol: conductor, guía, admin tienen secciones separadas.

## Capacitor — plugins requeridos

| Plugin | Propósito |
|--------|-----------|
| `@capacitor/geolocation` | Ubicación del conductor/pasajero |
| `@capacitor/push-notifications` | Notificaciones push |
| `@capacitor/camera` | Subida de documentos/fotos de perfil |
| `@capacitor/network` | Detección de conectividad |
| `@capacitor/storage` | Preferencias no críticas (tema, idioma) |

## Reglas de uso de almacenamiento local

| Dato | Permitido en localStorage/Capacitor Storage | Razón |
|------|---------------------------------------------|-------|
| Tema UI (claro/oscuro) | Sí | Preferencia visual |
| Idioma seleccionado | Sí | Preferencia UI |
| Token de sesión | No | Crítico — gestionado por Supabase Auth |
| Saldo wallet | No | Crítico — fuente de verdad en backend |
| Estado de viaje | No | Crítico — fuente de verdad en backend |
| Datos de pago | No | Crítico — solo backend |

## Manejo de errores en UI

Todo componente que consume datos del backend debe manejar:
1. `loading`: mostrar skeleton o spinner.
2. `error`: mostrar mensaje de error legible y opción de reintentar.
3. `empty`: estado vacío cuando no hay datos.
4. `success`: renderizado normal de datos.

## Consideraciones de conectividad

Rapa Nui puede tener conectividad móvil intermitente. La app debe:
- Detectar estado offline via `@capacitor/network`.
- Bloquear acciones críticas (pagos, iniciar viaje) sin conexión.
- Mostrar banner de estado offline visible.
- No cachear datos críticos localmente como solución permanente.
