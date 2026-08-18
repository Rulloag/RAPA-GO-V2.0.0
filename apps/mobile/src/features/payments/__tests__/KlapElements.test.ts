import { describe, expect, it } from "vitest";
import elementsSource from "../klapElements.service.ts?raw";
import walletsSource from "../KlapElementsWallets.tsx?raw";
import modalSource from "../KlapCheckoutModal.tsx?raw";

describe("Klap Elements — Apple Pay y Google Pay", () => {
  it("carga checkout-flex e inicializa initWallets según manual Klap", () => {
    expect(elementsSource).toContain("KLAP_FLEX.initWallets");
    expect(elementsSource).toContain("checkout-flex/v1/main.min.js");
    expect(elementsSource).toContain('wallets: config.wallets');
    expect(elementsSource).toContain("transparent: config.transparent");
  });

  it("expone contenedores klap-apple-pay y klap-google-pay con callbacks transparentes", () => {
    expect(walletsSource).toContain('id={KLAP_APPLE_PAY_CONTAINER_ID}');
    expect(walletsSource).toContain('id={KLAP_GOOGLE_PAY_CONTAINER_ID}');
    expect(walletsSource).toContain('"klap-fn-success"');
    expect(walletsSource).toContain('"klap-fn-error"');
    expect(walletsSource).toContain('wallets: ["applePay", "googlePay"]');
  });

  it("integra Elements en el modal de checkout", () => {
    expect(modalSource).toContain("KlapElementsWallets");
    expect(modalSource).toContain("isKlapElementsEnabled");
  });
});
