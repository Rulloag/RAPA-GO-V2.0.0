import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  NormalizedWebhook,
  NormalizedStatus,
} from "./payment.provider.js";

const MP_API_URL = "https://api.mercadopago.com";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function getConfig(): {
  accessToken: string;
  webhookSecret: string;
  environment: string;
  checkoutUrlMode: string;
} {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"] ?? "";
  const webhookSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"] ?? "";
  const environment = process.env["MERCADOPAGO_ENVIRONMENT"] ?? "sandbox";
  const checkoutUrlMode = process.env["MERCADOPAGO_CHECKOUT_URL_MODE"] ?? "init_point";

  if (!accessToken || accessToken.includes("PEGA_AQUI")) {
    throw new Error("MercadoPago credentials not configured. Falta MERCADOPAGO_ACCESS_TOKEN en el .env del API.");
  }

  return { accessToken, webhookSecret, environment, checkoutUrlMode };
}

function mapStatus(mpStatus: string): NormalizedStatus {
  switch (mpStatus) {
    case "approved":
      return "success";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "rejected";
    case "pending":
    case "in_process":
    case "authorized":
    case "in_mediation":
      return "pending";
    default:
      return "unknown";
  }
}

function isPrivateIp(hostname: string): boolean {
  return (
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function isLocalOrPrivate(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(normalized) || isPrivateIp(normalized);
}

function normalizePublicHttpsUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();

    // MercadoPago puede rechazar localhost/red local en back_urls y webhooks.
    // Para redirecciÃ³n automÃ¡tica usa un dominio HTTPS pÃºblico o Dev Tunnel.
    if (isLocalOrPrivate(hostname)) return null;
    if (url.protocol !== "https:") return null;

    return url.toString();
  } catch {
    return null;
  }
}

function buildPaymentResultUrl(
  baseUrl: string,
  result: "approved_return" | "failure_return" | "pending_return",
): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("payment", result);
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}payment=${result}`;
  }
}

function normalizePayerEmail(value: unknown): string | undefined {
  const email = String(value ?? "").trim().toLowerCase();

  if (!email) return undefined;
  if (email.includes("sin-correo")) return undefined;
  if (email.includes("local")) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;

  return email;
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  return (text || fallback).slice(0, maxLength);
}

function getMercadoPagoErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const message = parsed["message"] ?? parsed["error"] ?? parsed["cause"];

    if (Array.isArray(message)) return JSON.stringify(message);
    if (message) return String(message);

    return JSON.stringify(parsed);
  } catch {
    return body || `HTTP ${status}`;
  }
}

async function postPreference(
  preference: Record<string, unknown>,
  accessToken: string,
): Promise<{
  ok: boolean;
  status: number;
  text: string;
  data?: {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
    [k: string]: unknown;
  };
}> {
  const response = await fetch(`${MP_API_URL}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  });

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    return { ok: false, status: response.status, text };
  }

  try {
    return { ok: true, status: response.status, text, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: response.status, text: text || "MercadoPago returned invalid JSON." };
  }
}

function buildCheckoutUrl(
  data: { init_point?: string; sandbox_init_point?: string },
  config: { environment: string; checkoutUrlMode: string },
): string | undefined {
  if (config.checkoutUrlMode === "sandbox_init_point") {
    return data.sandbox_init_point ?? data.init_point;
  }

  if (config.checkoutUrlMode === "auto") {
    return config.environment === "production"
      ? data.init_point
      : data.sandbox_init_point ?? data.init_point;
  }

  return data.init_point ?? data.sandbox_init_point;
}

function withoutKeys(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const copy = { ...source };
  for (const key of keys) delete copy[key];
  return copy;
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const config = getConfig();

    const amount = Math.round(Number(params.amountClp));

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid MercadoPago amount: ${params.amountClp}`);
    }

    const orderId = String(params.orderId ?? "").trim();

    if (!orderId) {
      throw new Error("Missing MercadoPago orderId.");
    }

    const publicReturnUrl = normalizePublicHttpsUrl(params.returnUrl);
    const publicWebhookUrl = normalizePublicHttpsUrl(params.webhookUrl);
    const payerEmail = normalizePayerEmail(params.passengerEmail);

    if (!publicReturnUrl) {
      throw new Error(
        "Mercado Pago requiere una URL HTTPS pública de retorno para confirmar el pago y publicar el viaje inmediatamente.",
      );
    }

    if (!publicWebhookUrl) {
      throw new Error(
        "Mercado Pago requiere una URL HTTPS pública de webhook como respaldo de seguridad.",
      );
    }

    const preference: Record<string, unknown> = {
      items: [
        {
          id: normalizeText(`ride-${orderId}`, "ride", 64),
          title: normalizeText(params.description, "Viaje Rapa Go", 120),
          description: normalizeText(params.description, "Viaje Rapa Go", 250),
          quantity: 1,
          unit_price: amount,
          currency_id: "CLP",
        },
      ],
      payer: {
        ...(payerEmail ? { email: payerEmail } : {}),
        ...(params.passengerName
          ? { name: normalizeText(params.passengerName, "Pasajero", 80) }
          : {}),
      },
      external_reference: orderId,
      statement_descriptor: "RAPAGO",
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" },
          { id: "atm" },
        ],
        installments: 1,
      },
    };

    if (publicReturnUrl) {
      preference["back_urls"] = {
        success: buildPaymentResultUrl(publicReturnUrl, "approved_return"),
        failure: buildPaymentResultUrl(publicReturnUrl, "failure_return"),
        pending: buildPaymentResultUrl(publicReturnUrl, "pending_return"),
      };
      preference["auto_return"] = "approved";
    }

    if (publicWebhookUrl) {
      preference["notification_url"] = publicWebhookUrl;
    }

    console.log("[MercadoPago] Creando preferencia:", {
      amount,
      orderId,
      hasPayerEmail: Boolean(payerEmail),
      returnUrlOriginal: params.returnUrl,
      returnUrlUsada: publicReturnUrl,
      webhookUrlUsada: publicWebhookUrl,
      environment: config.environment,
      checkoutUrlMode: config.checkoutUrlMode,
      tokenPrefix: config.accessToken.slice(0, 8),
    });

    const attempts: Array<{ name: string; payload: Record<string, unknown> }> = [
      { name: "normal", payload: preference },
      {
        name: "sin payment_methods",
        payload: withoutKeys(preference, ["payment_methods"]),
      },
    ];

    let lastError: { status: number; text: string; parsedMessage: string } | null = null;

    for (const attempt of attempts) {
      const result = await postPreference(attempt.payload, config.accessToken);

      if (result.ok) {
        const data = result.data ?? {};
        const urlPay = buildCheckoutUrl(data, config);

        if (!urlPay || !data.id) {
          console.error("[MercadoPago] Respuesta incompleta:", data);
          throw new Error("MercadoPago response missing preference id or checkout URL.");
        }

        console.log("[MercadoPago] Preferencia creada OK:", {
          intento: attempt.name,
          providerOrderId: data.id,
          urlPay,
          redirectAutomatico: Boolean((attempt.payload as Record<string, unknown>)["back_urls"]),
        });

        return {
          providerOrderId: String(data.id),
          urlPay: String(urlPay),
        };
      }

      lastError = {
        status: result.status,
        text: result.text,
        parsedMessage: getMercadoPagoErrorMessage(result.status, result.text),
      };

      console.error(`[MercadoPago] Intento rechazado (${attempt.name}):`, lastError);
    }

    throw new Error(
      `MercadoPago API error ${lastError?.status ?? "unknown"}: ${lastError?.parsedMessage ?? "unknown error"}`,
    );
  }

  verifyWebhookSignature(payload: Record<string, unknown>, headers: Record<string, string>): boolean {
    try {
      const config = getConfig();

      if (!config.webhookSecret) {
        return false;
      }

      const xSignature = headers["x-signature"] ?? "";
      const xRequestId = headers["x-request-id"] ?? "";

      const parts: Record<string, string> = {};

      for (const segment of xSignature.split(",")) {
        const eq = segment.indexOf("=");
        if (eq === -1) continue;

        const key = segment.slice(0, eq).trim();
        const value = segment.slice(eq + 1).trim();

        parts[key] = value;
      }

      const ts = parts["ts"] ?? "";
      const v1 = parts["v1"] ?? "";

      if (!ts || !v1) return false;

      const dataId = String(
        headers["x-data-id"] ??
          (payload["data"] as Record<string, unknown> | undefined)?.["id"] ??
          "",
      ).trim();

      if (!dataId || !xRequestId) return false;

      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const expected = crypto
        .createHmac("sha256", config.webhookSecret)
        .update(manifest)
        .digest("hex");

      if (expected.length !== v1.length) return false;

      return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
    } catch {
      return false;
    }
  }

  async normalizeWebhook(
    payload: Record<string, unknown>,
    _headers: Record<string, string>,
  ): Promise<NormalizedWebhook> {
    const type = String(payload["type"] ?? "");

    if (type !== "payment") {
      return {
        orderId: "",
        status: "unknown",
        externalId: "",
        rawPayload: payload,
      };
    }

    const paymentId = String(
      _headers["x-data-id"] ??
        (payload["data"] as Record<string, unknown> | undefined)?.["id"] ??
        "",
    ).trim();

    if (!paymentId) {
      return {
        orderId: "",
        status: "unknown",
        externalId: "",
        rawPayload: payload,
      };
    }

    const config = getConfig();

    const response = await fetch(`${MP_API_URL}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      const text =
        typeof response.text === "function"
          ? await response.text().catch(() => "")
          : "";

      throw new Error(
        `MercadoPago API error ${response.status} fetching payment ${paymentId}: ${text}`,
      );
    }

    const data = (await response.json()) as {
      id: number;
      status: string;
      external_reference: string;
      [k: string]: unknown;
    };

    return {
      orderId: data.external_reference ?? "",
      status: mapStatus(data.status),
      externalId: String(data.id),
      rawPayload: data as Record<string, unknown>,
    };
  }
}
