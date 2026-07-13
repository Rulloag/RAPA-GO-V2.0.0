
# RAPA GO — Phase 2 Security Traceability

## Estado inicial

Rama:
security/remediation-leandro-wallet-phase-2

Base:
facture/leandro-ui con PR #3 mergeado.

## Verificación inicial

- API build baseline: OK
- API tests baseline: OK
- Mobile build baseline: OK

## Hallazgos iniciales confirmados

### Wallet/localStorage financiero

Se confirma uso de clave financiera local:

- rapago_wallet_benefits_v1
- rapago_wallet_auto_apply_benefits_v1

Archivos detectados:
- apps/mobile/src/pages/admin/index.tsx
- apps/mobile/src/pages/passenger/pages/RequestRidePage.tsx
- apps/mobile/src/pages/passenger/pages/TripsPage.tsx
- apps/mobile/src/pages/passenger/pages/WalletPage.tsx

Clasificación:
VULNERABLE / PARCIAL.

Motivo:
El frontend todavía participa en lectura/escritura de beneficios wallet mediante localStorage. Esto no debe ser fuente de verdad financiera.

### Cancelación y no-show

Coincidencias detectadas:
- cancellationFee
- noShow
- refund
- walletCredit
- creditToWallet
- refundAmount
- noShowFeeClp
- cancellationFeeClp

Clasificación:
PARCIAL.

Motivo:
Existe lógica repartida en frontend y backend. Se requiere centralizar política financiera autoritativa en backend.

### Reservas y pagos

Coincidencias detectadas:
- reservationRequiresCard
- paymentMethod
- paymentProvider
- rideMode
- scheduled

Clasificación:
PARCIAL.

Motivo:
Fase 1 reforzó backend para reservas con tarjeta, pero aún existe lógica visual y local extensa que debe auditarse.

### Webhooks e idempotencia

Coincidencias detectadas:
- mercadopago
- prontopaga
- webhook
- idempot
- providerTransactionId
- externalReference

Clasificación:
PARCIAL.

Motivo:
Fase 1 agregó idempotencia básica, pero Fase 2 debe revisar firma, replay, concurrencia, moneda, monto y estados regresivos.

### WhatsApp / PII

Coincidencias detectadas:
- wa.me
- whatsapp
- WhatsApp

Clasificación:
PARCIAL / RIESGO PRIVACIDAD.

Motivo:
Hay mensajes generados con datos operativos de viajes, pasajeros, conductores, devolución y no-show. Se debe minimizar PII y usar folio corto.

## Prioridad de implementación

1. Wallet/localStorage financiero.
2. Backend Wallet autoritativa.
3. Cancelación/no-show backend.
4. Pruebas de manipulación localStorage/payload.
5. WhatsApp/PII.
6. Webhooks avanzados.

## Evidencia

- docs/security/evidence/phase2/00_branch.txt
- docs/security/evidence/phase2/01_git_status.txt
- docs/security/evidence/phase2/02_git_log.txt
- docs/security/evidence/phase2/03_date.txt
- docs/security/evidence/phase2/04_npm_install.txt
- docs/security/evidence/phase2/05_build_api_baseline.txt
- docs/security/evidence/phase2/06_test_api_baseline.txt
- docs/security/evidence/phase2/07_build_mobile_baseline.txt
- docs/security/evidence/phase2/10_wallet_localstorage_refs.txt
- docs/security/evidence/phase2/11_wallet_financial_refs.txt
- docs/security/evidence/phase2/12_cancellation_no_show_refs.txt
- docs/security/evidence/phase2/13_reservation_payment_refs.txt
- docs/security/evidence/phase2/14_payment_webhook_refs.txt
- docs/security/evidence/phase2/15_whatsapp_pii_refs.txt

## Estado

FASE 2 — MAPA INICIAL COMPLETADO.
NO IMPLEMENTAR CAMBIOS SIN PARCHE CONTROLADO.

