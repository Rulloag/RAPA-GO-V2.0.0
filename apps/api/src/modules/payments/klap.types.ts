// Klap Checkout Transparente — tipos internos.
//
// Alcance de esta fase: SOLO creación de orden en Sandbox. El webhook (Fase C) y la
// conexión con PaymentsService (Fase D) no están implementados aquí.
//
// CAMPOS CONFIRMADOS por la documentación entregada (no inventados):
//   - Header de autenticación: "Api-Key".
//   - Header de idempotencia: "Idempotency-Key" (vigencia documentada: 24 horas).
//   - Identificador único de transacción: "consumer_transaction_id".
//   - Montos en CLP, enteros (Klap Checkout Transparente).
//   - Endpoints: sandbox "https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders",
//     producción "https://api.pasarela.multicaja.cl/payment-gateway/v1/orders".
//   - La respuesta de creación de orden incluye un "order_id" (referenciado de forma
//     consistente en toda la documentación entregada).
//
// CAMPOS NO CONFIRMADOS (deliberadamente NO incluidos en el request saliente):
//   descripción de la orden, email/nombre del pagador, return_url, webhook_url,
//   objeto "commerce"/comercio, campos custom. MercadoPago/ProntoPaga sí los envían,
//   pero para Klap Checkout Transparente su nombre exacto de campo no pudo verificarse
//   contra el Swagger real (bloqueado por 403 / SPA no renderizable). Agregar estos
//   campos requiere confirmar el schema oficial antes de tocar este archivo de nuevo.

export type KlapEnvironment = "sandbox" | "production";

/** Config resuelta desde variables de entorno. Nunca se expone tal cual al frontend. */
export interface KlapConfig {
  environment: KlapEnvironment;
  ordersUrl: string;
  apiKey: string;
  requestTimeoutMs: number;
}

/**
 * Cuerpo exacto enviado a POST {ordersUrl}.
 * Contiene ÚNICAMENTE los campos confirmados — ver nota de cabecera.
 */
export interface KlapCreateOrderRequestBody {
  consumer_transaction_id: string;
  amount: number;
  currency: "CLP";
}

/**
 * Respuesta cruda de Klap, sin validar. Tratada como `unknown` hasta pasar por
 * `parseKlapOrderResponse` — nunca se persiste ni se reenvía tal cual.
 */
export type KlapCreateOrderRawResponse = unknown;

/** Subconjunto validado y mínimo de la respuesta que este provider efectivamente usa. */
export interface KlapCreateOrderValidatedResponse {
  order_id: string;
}

export type KlapProviderErrorKind =
  | "config" // credenciales/URL faltantes o entorno no soportado en esta fase
  | "timeout" // AbortController disparado
  | "network" // fetch rechazó por un error de red (no timeout)
  | "http_rejected" // Klap respondió con un status HTTP no-2xx
  | "invalid_response"; // 2xx pero el body no es JSON válido o no trae order_id

/**
 * Error normalizado y saneado. `message` nunca debe contener la ApiKey ni el body
 * completo de la respuesta — solo lo mínimo para diagnosticar el fallo.
 */
export class KlapProviderError extends Error {
  readonly kind: KlapProviderErrorKind;
  readonly httpStatus: number | undefined;

  constructor(kind: KlapProviderErrorKind, message: string, httpStatus?: number) {
    super(message);
    this.name = "KlapProviderError";
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}
