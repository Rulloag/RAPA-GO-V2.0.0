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


## FASE 7 — Validación backend de reservas con tarjeta

Se implementó una primera validación autoritativa en backend para impedir que una reserva/agendamiento sea creada como efectivo.

Archivos modificados:
- apps/api/src/modules/rides/rides.schemas.ts
- apps/api/src/modules/rides/rides.service.ts

Control agregado:
- Si el viaje es scheduled/agendado, el backend exige paymentMethod = card.
- Si se declara paymentProvider, solo permite mercadopago, prontopaga o transbank.
- El bloqueo no depende del botón ni del estado React.

Resultado build:
- npm run build -w apps/api continúa FALLANDO por errores TS4111 preexistentes.
- No se detectan errores nuevos asociados a paymentMethod, paymentProvider o SCHEDULED_RIDE_REQUIRES_CARD.

Evidencia:
- docs/security/evidence/70_patch_scheduled_card_backend.diff
- docs/security/evidence/71_build_api_after_scheduled_card.txt

Estado:
PARCIAL. Falta agregar prueba automatizada que envíe rideMode=scheduled y paymentMethod=cash esperando error SCHEDULED_RIDE_REQUIRES_CARD.


## FASE 6 — Riesgo en cálculo de tarifa del viaje

### Evidencia

Archivos:
- docs/security/evidence/72_estimate_fare_function.txt
- docs/security/evidence/73_fare_sources.txt
- docs/security/evidence/74_fare_financial_risk.txt

### Hallazgo

El backend posee una función estimateFare que consulta:
- fare_settings
- zone_fares

Sin embargo, si la consulta falla, utiliza un cálculo local basado en longitud de texto de origen/destino.

Además, createRideRequest aún utiliza input.estimatedFareClp enviado por el frontend como base para crear el viaje.

PaymentsService usa ride.estimatedFareClp para crear pagos.

### Clasificación

VULNERABLE / PARCIAL.

### Riesgo

Un cliente manipulado podría modificar estimatedFareClp antes de crear el viaje.
Ese valor puede terminar guardado en ride_requests.estimated_fare_clp y luego ser utilizado como monto de pago.

### Decisión conservadora

No se reemplaza inmediatamente estimatedFareClp por estimateFare de forma ciega, porque el frontend actualmente mezcla:
- promociones
- beneficios Wallet
- cargos pendientes
- tarifas con extras
- tarifas fijas

Cambiarlo sin migrar esas reglas al backend puede romper pagos, reservas y Wallet.

### Solución requerida

Crear una política backend autoritativa de pricing:
- RidePricingService
- WalletCreditService backend
- CancellationPolicyService
- NoShowPolicyService

El frontend solo debe mostrar estimaciones.
El backend debe calcular el monto final cobrable.

Estado:
NO APTO PARA MERGE.


## FASE 5 / FASE 8 — Evidencia de monto financiero controlado por frontend

### Evidencia

Archivos:
- docs/security/evidence/75_request_ride_payload_detail.txt
- docs/security/evidence/76_trips_cancel_wallet_detail.txt
- docs/security/evidence/77_payments_create_amount_detail.txt
- docs/security/evidence/78_payments_webhook_detail.txt

### Hallazgo

El frontend construye payloads con:
- estimatedFareClp
- walletBenefitAppliedClp
- walletBenefitDiscountClp
- finalFareAfterWalletBenefitClp
- passengerPendingChargeClp
- reservationRequiresCard

PaymentsService crea el pago usando ride.estimatedFareClp.

### Riesgo

Un cliente manipulado podría alterar el monto antes de crear el viaje y ese monto puede ser usado después para el cobro.

### Estado

VULNERABLE / PARCIAL.

Se requiere que el backend sea fuente autoritativa del monto final.


## FASE 6 — Control parcial contra manipulación de tarifa

Se implementó control backend para evitar que estimatedFareClp enviado por el cliente reduzca el monto por debajo de la estimación calculada por servidor.

Archivo modificado:
- apps/api/src/modules/rides/rides.service.ts

Control agregado:
- El backend calcula serverEstimatedFare.
- Si el cliente no envía tarifa válida, se usa serverEstimatedFare.
- Si el cliente envía tarifa, el backend usa Math.max(clientFare, serverEstimatedFare).
- Esto evita subpago por manipulación del payload o localStorage.

Limitación:
- Este control es parcial.
- Todavía falta mover promociones, beneficios Wallet y cargos pendientes a backend autoritativo.
- El frontend aún puede mandar montos altos o metadatos financieros, pero ya no puede reducir el precio bajo la estimación servidor.

Evidencia:
- docs/security/evidence/79_patch_backend_fare_floor.diff
- docs/security/evidence/80_build_api_after_fare_floor.txt

Estado:
PARCIAL. NO APTO PARA MERGE todavía.

