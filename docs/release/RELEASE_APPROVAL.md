# RAPA GO — Aprobación interna de lanzamiento

## Congelamiento

- Fecha y hora: ______________________________
- Rama: _____________________________________
- Commit congelado: __________________________
- Tag: ______________________________________
- Versión Android / versionCode: ______________
- Versión iOS / build: ________________________
- SHA-256 del AAB: ____________________________
- SHA-256 del archive/IPA: ____________________
- Pista/TestFlight probado: ___________________

## Código y base de datos

- [ ] Rama sincronizada con `origin/main`.
- [ ] Árbol Git limpio.
- [ ] `npm ci` reproducible.
- [ ] Typecheck aprobado.
- [ ] Pruebas API y mobile aprobadas.
- [ ] Builds API/mobile/shared aprobados.
- [ ] `npm run verify:release` aprobado.
- [ ] Migraciones 0041 y 0042 aplicadas en Supabase.
- [ ] Verificación SQL 0042 guardada.
- [ ] Backup/PITR confirmado antes de migrar.

## Funciones críticas

- [ ] Viaje completo pasajero/conductor.
- [ ] Cancelación 30 %, tope $3.000.
- [ ] No show 50 %, tope $5.000 y reparto 50/50.
- [ ] Pago Mercado Pago real.
- [ ] Cierre efectivo y beneficio real.
- [ ] Eliminación sin motivo.
- [ ] Reintento de solicitud `failed`.
- [ ] Revocación Apple real y nuevo registro.
- [ ] Purga de ubicación y datos bancarios probada.

## Publicación

- [ ] URLs `api.rapago.cl` accesibles desde datos móviles.
- [ ] AAB firmado probado en pista interna.
- [ ] Archive iOS/TestFlight probado.
- [ ] Data Safety revisado contra el AAB.
- [ ] App Privacy revisado contra el archive.
- [ ] Ubicación en segundo plano documentada.
- [ ] Cuentas y notas de revisión cargadas.
- [ ] Emisión tributaria/DTE certificada.
- [ ] Evidencias externas completas.

## Firmas

| Área | Nombre | Fecha | Estado / firma |
|---|---|---|---|
| Desarrollo | | | |
| Soporte | | | |
| Jurídica / Privacidad | | | |
| Contabilidad / Finanzas | | | |
| Gerencia | | | |

## Dictamen

- [ ] **GO**: todo pertenece al commit congelado y no quedan bloqueadores.
- [ ] **NO-GO**: existen puntos pendientes o evidencia incompleta.

Observaciones:
__________________________________________________________________
__________________________________________________________________
