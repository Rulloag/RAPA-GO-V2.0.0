import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativeUrl: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeUrl, import.meta.url)),
    "utf8",
  );
}

const serviceSource = source("../payments.service.ts");
const routesSource = source("../payments.routes.ts");
const controllerSource = source("../payments.controller.ts");
const repositorySource = source("../payments.repository.ts");
const providerSource = source("../klap.provider.ts");

describe("PaymentsService Klap V108 — contrato de seguridad", () => {
  it("crea checkout redirect y persiste redirect_url como urlPay", () => {
    expect(serviceSource).toContain("provider.createHostedOrder");
    expect(serviceSource).toContain('checkoutType: "redirect"');
    expect(serviceSource).toContain("redirectUrl: activeRedirectUrl");
    expect(serviceSource).toContain("hostedResult.urlPay");
    expect(serviceSource).toContain("paymentsRepo.markProcessing(");
    expect(repositorySource).toContain("urlPay,");
  });

  it("recupera una orden activa y evita crear una segunda mientras siga vigente", () => {
    expect(serviceSource).toContain("findActiveByRideIdAndPurpose");
    expect(serviceSource).toContain("isKlapPaymentExpired");
    expect(serviceSource).toContain("KLAP_ORDER_RECOVERY_PENDING");
    expect(serviceSource).toContain("provider.getOrder(activeOrderId)");
  });

  it("expone reconciliación autenticada por paymentId", () => {
    expect(routesSource).toContain('"/payments/:paymentId/reconcile/klap"');
    expect(controllerSource).toContain("reconcileKlapPayment");
    expect(serviceSource).toContain("async reconcileKlapPayment(");
    expect(serviceSource).toContain("remoteOrder.reference_id !== payment.id");
    expect(serviceSource).toContain("Math.round(remoteTotal) !== payment.amountClp");
    expect(serviceSource).toContain('remoteCurrency !== "CLP"');
  });

  it("solo aprueba después de consultar la orden oficial o recibir webhook", () => {
    expect(serviceSource).toContain("getKlapProvider().getOrder(orderId)");
    expect(serviceSource).toContain("markAuthorizedAndActivateRide");
    expect(serviceSource).toContain("markRejected");
    expect(serviceSource).not.toContain("KLAP_SANDBOX_TEST_OUTCOME");
  });

  it("el confirm de Klap nunca marca success: solo authorized (retención)", () => {
    const confirmStart = serviceSource.indexOf("async handleKlapConfirmWebhook(");
    const rejectStart = serviceSource.indexOf("async handleKlapRejectWebhook(");
    expect(confirmStart).toBeGreaterThanOrEqual(0);
    expect(rejectStart).toBeGreaterThan(confirmStart);
    const confirmSource = serviceSource.slice(confirmStart, rejectStart);
    expect(confirmSource).toContain("markAuthorizedAndActivateRide");
    expect(confirmSource).not.toContain("markSuccessAndActivateRide");
    expect(providerSource).toContain("KLAP_TRANSACTION_TYPE_AUTHORIZATION");
  });

  it("mantiene return/cancel como señales no autoritativas", () => {
    expect(routesSource).toContain('"/payments/return/klap"');
    expect(routesSource).toContain('"/payments/cancel/klap"');
    expect(serviceSource).toContain("backendReconciled: false");
    expect(serviceSource).toContain('"pending_return"');
    expect(serviceSource).toContain('"failure_return"');
  });

  it("no contiene procesamiento directo de tarjeta en el flujo Klap alojado", () => {
    expect(serviceSource).not.toMatch(/cards\/receipt|KLAP\.payOrder|Cardinal\.continue/);

    const hostedStart = serviceSource.indexOf("async createKlapEmbeddedOrder(");
    const reconcileStart = serviceSource.indexOf("async reconcileKlapPayment(");

    expect(hostedStart).toBeGreaterThanOrEqual(0);
    expect(reconcileStart).toBeGreaterThan(hostedStart);

    const hostedFlowSource = serviceSource.slice(hostedStart, reconcileStart);
    const klapHostedIntegration = `${hostedFlowSource}\n${providerSource}`;

    expect(klapHostedIntegration).not.toMatch(
      /card_number|security_code|\bcvv\b/i,
    );
  });
});
