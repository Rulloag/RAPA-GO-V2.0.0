import type { PaymentProvider } from "./payment.provider.js";
import { ProntoPagaProvider }  from "./prontopaga.provider.js";
import { MercadoPagoProvider } from "./mercadopago.provider.js";

const providers: Record<string, PaymentProvider> = {
  prontopaga:  new ProntoPagaProvider(),
  mercadopago: new MercadoPagoProvider(),
};

/** Return a provider by name. Throws if unknown. */
export function getProvider(name: string): PaymentProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown payment provider: "${name}"`);
  return provider;
}

/**
 * Return the currently active provider for creating new payments.
 * Defaults to MercadoPago. Override via PAYMENT_PROVIDER env var.
 *
 * ProntoPaga is disabled by default (Fase 4 commercial decision).
 * Transbank remains a future option (set PAYMENT_PROVIDER=transbank when ready).
 */
export function getActiveProvider(): PaymentProvider {
  const name = process.env["PAYMENT_PROVIDER"] ?? "mercadopago";
  return getProvider(name);
}
