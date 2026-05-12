# ADR-0004: Prohibición de localStorage para Flujos Críticos

**Estado**: Aprobado
**Fecha**: 2026-05-11
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

En aplicaciones web y móviles híbridas existe la tentación de usar `localStorage` (o equivalentes como `Capacitor Storage`, `sessionStorage`, `IndexedDB`) para almacenar estado de la aplicación en el cliente. Para flujos críticos como wallet, pagos y viajes esto representa riesgos de seguridad y consistencia.

## Decisión

**`localStorage` está prohibido para flujos críticos.** Solo puede usarse para preferencias de interfaz de usuario no críticas.

### Uso permitido

| Dato | Justificación |
|------|--------------|
| Tema (claro/oscuro) | Preferencia visual, sin impacto en seguridad |
| Idioma seleccionado | Preferencia UI, sin impacto en seguridad |
| Última ruta visitada | Conveniencia UX, sin datos sensibles |

### Uso prohibido

| Dato | Por qué está prohibido |
|------|----------------------|
| Token de sesión activa | Riesgo XSS. Usar Secure Storage nativo de Capacitor o gestión via Supabase Auth en memoria. |
| Saldo de wallet | Puede ser manipulado. El saldo real siempre viene del backend. |
| Estado de viaje activo | El estado real vive en la BD. El cliente lo obtiene via Realtime o al montar la pantalla. |
| Datos de pago | Riesgo de seguridad y fraude. |
| Matching activo | Estado crítico que vive en BD. |
| Aprobaciones administrativas | Estado crítico que vive en BD. |
| Datos de otros usuarios | Privacidad y seguridad. |

## Motivo

1. **XSS**: `localStorage` es accesible por JavaScript en la misma página. Un ataque XSS puede extraer tokens o datos sensibles.
2. **Consistencia**: Si el cliente almacena saldo o estado de viaje, puede quedar desincronizado con la base de datos (crash de app, múltiples dispositivos).
3. **Manipulación**: Un usuario técnico puede modificar `localStorage` manualmente. Si el cliente confía en estos datos, hay vectores de fraude.
4. **Multi-dispositivo**: `localStorage` es local. Si el usuario cambia de dispositivo, los datos no existen. El estado debe vivir en el backend.

## Implementación para tokens de sesión

- **Supabase Auth**: Gestiona el token internamente. En Capacitor, usa `localStorage` de forma controlada con mitigaciones propias. Se acepta este uso específico de Supabase Auth porque está encapsulado y no es manipulable directamente por la lógica de la app.
- **Capacitor Secure Storage**: Para cualquier dato sensible que deba persistir localmente, usar `@capacitor/preferences` que usa el Keychain de iOS y EncryptedSharedPreferences de Android.

## Consecuencias

- La app debe hacer requests al backend para obtener el estado actual al montar cada pantalla crítica.
- Se requiere manejo correcto de estados de carga (`loading`) y error en todas las pantallas críticas.
- No hay modo offline para flujos críticos. Esto es aceptado: sin conexión no se puede viajar ni pagar.
