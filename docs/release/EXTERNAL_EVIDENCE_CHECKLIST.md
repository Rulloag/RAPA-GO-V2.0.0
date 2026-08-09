# RAPA GO — Evidencias externas obligatorias

Guardar las evidencias sin contraseñas, tokens, claves privadas, URLs firmadas ni datos personales reales.

## Supabase

- [ ] Captura del proyecto y región São Paulo / `sa-east-1`.
- [ ] Captura o export de migraciones aplicadas, incluyendo 0041 y 0042.
- [ ] Resultado de `0042_production_closure_verify.sql`.
- [ ] Estado de backups/PITR.
- [ ] Prueba documentada de restauración o procedimiento de recuperación.
- [ ] Inventario de buckets y políticas de acceso.
- [ ] Lista de personas/roles administrativos, sin credenciales.

## Hostinger

- [ ] Dominio `backend.rapago.cl` activo.
- [ ] Versión de Node compatible.
- [ ] Nombres de variables configuradas, con valores ocultos.
- [ ] Log de arranque sin secretos.
- [ ] Health check y conexión a DB.
- [ ] Política de backup y retención de logs.

## Apple

- [ ] Apple Developer activo para Haka Taiko SpA.
- [ ] App ID `cl.rapago.app` y capacidad Sign in with Apple.
- [ ] Key ID y Team ID configurados.
- [ ] Captura de redirect/callback correspondiente.
- [ ] Archive firmado y build en TestFlight.
- [ ] App Privacy completado.
- [ ] Video de inicio de sesión Apple.
- [ ] Video de eliminación y revocación.
- [ ] Prueba de nuevo registro con la misma cuenta Apple.
- [ ] Prueba de ubicación en segundo plano en iPhone real.

## Google Play

- [ ] AAB firmado y procesado sin error.
- [ ] SHA-256 del AAB.
- [ ] Data Safety reconciliado con el AAB final.
- [ ] URL pública de eliminación: `https://api.rapago.cl/eliminar-cuenta`.
- [ ] Política: `https://api.rapago.cl/privacidad`.
- [ ] Formulario y video de ubicación en segundo plano.
- [ ] Cuenta pasajero y conductor QA cargadas en Play Console.
- [ ] Notas del revisor cargadas.
- [ ] Prueba en pista interna.

## Google Sign-In y retiro de Facebook

- [ ] Google OAuth/Client IDs coinciden con web, Android e iOS.
- [ ] Prueba de cuenta nueva con Google.
- [ ] Prueba de vinculación Google con cuenta RAPA GO existente sin crear duplicado.
- [ ] Reingreso con Google conserva el mismo `user.id`.
- [ ] Confirmación de que Facebook no aparece en Login ni Perfil.
- [ ] Confirmación de que el backend no expone rutas `/api/auth/facebook/*`.
- [ ] Confirmación de que el binario final no incorpora SDK de Meta/Facebook ni tracking publicitario.

## Dispositivos reales

- [ ] Android: registro, login, viaje, segundo plano, pantalla bloqueada, pérdida de red, cancelación, no show y eliminación.
- [ ] iPhone: registro Apple, viaje, segundo plano, pantalla bloqueada, pérdida de red, cancelación y eliminación Apple.
- [ ] Modelo, versión del sistema, fecha, responsable y commit probado.
- [ ] Evidencia de que el GPS se detiene al finalizar/cancelar.
- [ ] Consumo de batería documentado.

## Tributación

- [ ] Certificación escrita de Contabilidad.
- [ ] Responsable de emitir el documento de transporte.
- [ ] Responsable de emitir el documento por comisión.
- [ ] Flujo para efectivo.
- [ ] Flujo para Klap.
- [ ] Flujo para hoteles/empresas.
- [ ] Prueba de emisión real ante SII/proveedor DTE.
- [ ] Corrección/anulación y conciliación por `rideId`.

## Firmas

- [ ] Desarrollo.
- [ ] Soporte.
- [ ] Jurídica/Privacidad.
- [ ] Contabilidad/Finanzas.
- [ ] Gerencia.
