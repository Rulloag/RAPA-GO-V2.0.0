import type { PaymentProvider } from "./payment.provider.js";
import { ProntoPagaProvider }  from "./prontopaga.provider.js";
import { MercadoPagoProvider } from "./mercadopago.provider.js";
import { KlapProvider }        from "./klap.provider.js";

const providers: Record<string, PaymentProvider> = {
  prontopaga:  new ProntoPagaProvider(),
  mercadopago: new MercadoPagoProvider(),
};

// Klap is deliberately NOT in the `providers` map above: that map is typed as
// `Record<string, PaymentProvider>` (the redirect-oriented interface), and
// KlapProvider.createPayment() intentionally throws (see klap.provider.ts) rather
// than pretend to support redirect. Adding it there would only invite an unsafe
// cast or an `instanceof`/name check the first time someone tried to use its real
// capability. Klap's actual entry point (`createEmbeddedOrder`) is exposed here
// through its own concretely-typed getter instead — no cast needed, since the
// return type is `KlapProvider` itself, not the narrower `PaymentProvider`.
const klapProvider = new KlapProvider();

/**
 * Klap Checkout Transparente — Sandbox-only embedded provider (see klap.provider.ts).
 * Not part of `getActiveProvider()`/`PAYMENT_PROVIDER`: reaching Klap requires
 * calling this getter explicitly from a controlled path (Fase D: a dedicated
 * route), never through the generic redirect-oriented provider selection.
 */
export function getKlapEmbeddedProvider(): KlapProvider {
  return klapProvider;
}

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
