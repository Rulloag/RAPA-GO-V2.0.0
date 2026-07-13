# RAPA GO — LEANDRO REMEDIATION REPORT

## 1. Resumen ejecutivo

Estado inicial: NO APTO PARA MERGE.

Se inicia remediación de seguridad en rama:

security/remediation-leandro-wallet

Objetivo:
- Revisar Wallet.
- Eliminar localStorage como fuente de verdad financiera.
- Centralizar cancelaciones y no-show en backend.
- Validar reservas con tarjeta desde backend.
- Reducir PII en WhatsApp.
- Mejorar trazabilidad y controles alineados a ISO/IEC 27001, OWASP ASVS y buenas prácticas de seguridad.

## 2. Rama y commits revisados

Rama origen:
facture/leandro-ui

Rama remediación:
security/remediation-leandro-wallet

Commit base:
ebf955c6f1afb61fdcf908932924868843140bcf

Fecha:
07/13/2026 09:48:56

## 3. Estado inicial

Pendiente completar con resultados de:
- instalación
- lint
- typecheck
- tests
- build backend
- build frontend

## 4. Evidencia inicial

Ver carpeta:

docs/security/evidence/

## 5. Hallazgos iniciales

Pendiente confirmar con evidencia del repositorio.

## 6. Recomendación actual

NO APTO PARA MERGE.

---

ESTADO: NO APTO PARA MERGE
CRÍTICOS ABIERTOS: PENDIENTE
ALTOS ABIERTOS: PENDIENTE
TESTS: PENDIENTE
BUILD: PENDIENTE
TYPECHECK: PENDIENTE
LINT: PENDIENTE
COMMITS CREADOS: 0
ARCHIVOS MODIFICADOS: docs/security/LEANDRO_REMEDIATION_REPORT.md
MIGRACIONES: PENDIENTE
RIESGOS RESIDUALES: PENDIENTE

## FASE 1 — Validación del estado inicial

| Comando | Resultado | Errores preexistentes | Errores introducidos |
| ------- | --------- | --------------------- | -------------------- |
| npm run build -w apps/api | FALLA | TS4111 en db/client, payments y rides | Ninguno |
| npm run build -w apps/mobile | FALLA | Errores TypeScript en driver, passenger, RequestRidePage, TripsPage y apiClient | Ninguno |
| npm test -w apps/api | FALLA | 43 tests pasan, 2 fallan en payments/MercadoPago | Ninguno |

Conclusión:
El estado inicial no está apto para merge. Los errores se registran como preexistentes porque no se ha modificado código funcional antes de la validación.

Evidencias:
- docs/security/evidence/30_build_api.txt
- docs/security/evidence/31_build_mobile.txt
- docs/security/evidence/32_test_api.txt


## FASE 2 — Trazabilidad financiera preliminar

### Evidencia revisada

- docs/security/evidence/50_wallet_routes.txt
- docs/security/evidence/52_wallet_service.txt
- docs/security/evidence/54_wallet_schema.txt
- docs/security/evidence/57_rides_backend_methods.txt
- docs/security/evidence/59_backend_payment_scheduled_rules.txt

### Mapa preliminar

| Acción | Frontend | Endpoint | Servicio backend | Repositorio DB | Tabla | Validación |
| ------ | -------- | -------- | ---------------- | -------------- | ----- | ---------- |
| Consultar Wallet | WalletPage/Home/Trips | GET /api/wallets/me | WalletService.getMyWallet | WalletRepository.getOrCreate | wallets | Autenticación por token |
| Consultar transacciones | WalletPage | GET /api/wallets/me/transactions | WalletService.getMyTransactions | WalletRepository.listTransactions | transactions | Autenticación por token, ownership por userId |
| Crear orden de pago | Frontend envía rideId y amount | POST /api/payments/create-order | WalletService.createPaymentOrder | WalletRepository.createPaymentOrder | payment_orders | Valida ownership del ride, pero acepta input.amount |
| Procesar webhook Wallet | Proveedor externo | POST /api/payments/webhook | WalletService.handleWebhook | updatePaymentOrderStatus/createTransaction | payment_orders/transactions | No se confirma firma, idempotencia ni transacción atómica |
| Crear viaje | Passenger frontend | POST /api/rides/request | RidesService.createRideRequest | RidesRepository.create | ride_requests | Acepta estimatedFareClp desde cliente |
| Reserva programada | Passenger frontend | POST /api/rides/request | RidesService.createRideRequest | RidesRepository.createScheduledRideRequest | ride_requests | No se confirma bloqueo backend de cash/card |

### Clasificación

| Punto auditado | Estado | Evidencia |
| -------------- | ------ | --------- |
| Backend recalcula montos | PARCIAL / VULNERABLE | createPaymentOrder usa input.amount |
| Backend ignora montos del cliente | VULNERABLE | amount llega desde request |
| Wallet persistida en DB | CONFIRMADO PARCIAL | Existen wallets, transactions, payment_orders |
| Transacciones atómicas | EVIDENCIA INSUFICIENTE | No se observa db.transaction en WalletService |
| Créditos con identificador único | PARCIAL | Existe transaction.id, no idempotencyKey |
| Idempotencia | EVIDENCIA INSUFICIENTE / VULNERABLE | No se observa unique idempotencyKey |
| Admin y pasajero misma fuente | EVIDENCIA INSUFICIENTE | Falta revisar Admin wallet |
| Pasajero aprueba su propio crédito | EVIDENCIA INSUFICIENTE | No se observan endpoints approve/reject |
| Conductor altera penalización | EVIDENCIA INSUFICIENTE | Falta revisar cancel/no-show backend |
| Reserva scheduled cash manipulada | VULNERABLE PROBABLE | createRideRequestSchema no exige paymentMethod/card |

### Estado FASE 2

NO APTO PARA MERGE.

