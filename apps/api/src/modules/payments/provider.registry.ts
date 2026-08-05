import type { PaymentProvider } from "./payment.provider.js";
import { ProntoPagaProvider } from "./prontopaga.provider.js";
import { MercadoPagoProvider } from "./mercadopago.provider.js";
import { KlapProvider } from "./klap.provider.js";

const providers: Record<string, PaymentProvider> = {
  prontopaga: new ProntoPagaProvider(),
  mercadopago: new MercadoPagoProvider(),
};

const klapProvider = new KlapProvider();

/**
 * Proveedor Klap alojado. Se mantiene fuera de PAYMENT_PROVIDER para no cambiar
 * los flujos históricos de Mercado Pago/ProntoPaga; la ruta dedicada de Klap lo
 * obtiene explícitamente.
 */
export function getKlapProvider(): KlapProvider {
  return klapProvider;
}

/** Alias temporal para evitar romper imports antiguos durante el despliegue V108. */
export const getKlapEmbeddedProvider = getKlapProvider;

/** Return a provider by name. Throws if unknown. */
export function getProvider(name: string): PaymentProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown payment provider: "${name}"`);
  return provider;
}

export function getActiveProvider(): PaymentProvider {
  const name = process.env["PAYMENT_PROVIDER"] ?? "mercadopago";
  return getProvider(name);
}
