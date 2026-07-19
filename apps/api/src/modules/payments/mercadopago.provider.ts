import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  NormalizedWebhook,
  NormalizedStatus,
} from "./payment.provider.js";

const MP_API_URL = "https://api.mercadopago.com";

function getConfig(): { accessToken: string; webhookSecret: string; environment: string } {
  const accessToken   = process.env["MERCADOPAGO_ACCESS_TOKEN"]   ?? "";
  const webhookSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"]  ?? "";
  const environment   = process.env["MERCADOPAGO_ENVIRONMENT"]     ?? "sandbox";

  if (!accessToken) {
    throw new Error("MercadoPago credentials not configured (MERCADOPAGO_ACCESS_TOKEN).");
  }

  return { accessToken, webhookSecret, environment };
}

function mapStatus(mpStatus: string): NormalizedStatus {
  switch (mpStatus) {
    case "approved":                         return "success";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":                     return "rejected";
    case "pending":
    case "in_process":
    case "authorized":
    case "in_mediation":                     return "pending";
    default:                                 return "unknown";
  }
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const config = getConfig();

    const preference = {
      items: [{
        id:         `ride-${params.orderId}`,
        title:      params.description,
        quantity:   1,
        unit_price: params.amountClp,
        currency_id: "CLP",
      }],
      payer: {
        email: params.passengerEmail,
        name:  params.passengerName,
      },
      back_urls: {
        success: params.returnUrl,
        failure: params.returnUrl,
        pending: params.returnUrl,
      },
      auto_return:          "approved",
      notification_url:     params.webhookUrl,
      external_reference:   params.orderId,
      statement_descriptor: "RAPA GO",
    };

    const response = await fetch(`${MP_API_URL}/checkout/preferences`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`MercadoPago API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      id?:              string;
      init_point?:      string;
      sandbox_init_point?: string;
      [k: string]: unknown;
    };

    const urlPay =
      config.environment === "production"
        ? data.init_point
        : (data.sandbox_init_point ?? data.init_point);

    if (!urlPay || !data.id) {
      throw new Error("MercadoPago response missing preference id or checkout URL.");
    }

    return {
      providerOrderId: String(data.id),
      urlPay:          String(urlPay),
    };
  }

  verifyWebhookSignature(payload: Record<string, unknown>, headers: Record<string, string>): boolean {
    try {
      const config = getConfig();

      // Fail closed: without a configured secret there is no way to verify
      // authenticity, so the webhook must be rejected, never accepted.
      if (!config.webhookSecret) return false;

      const xSignature = headers["x-signature"] ?? "";
      const xRequestId = headers["x-request-id"] ?? "";

      // x-signature format: "ts=1704067200,v1=abc123..."
      const parts: Record<string, string> = {};
      for (const segment of xSignature.split(",")) {
        const eq  = segment.indexOf("=");
        if (eq === -1) continue;
        parts[segment.slice(0, eq)] = segment.slice(eq + 1);
      }
      const ts = parts["ts"] ?? "";
      const v1 = parts["v1"] ?? "";
      if (!ts || !v1) return false;

      const dataId   = String((payload["data"] as Record<string, unknown>)?.["id"] ?? "");
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const expected = crypto.createHmac("sha256", config.webhookSecret).update(manifest).digest("hex");

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
    // MP sends: { type: "payment", action: "payment.updated", data: { id: "123" } }
    // Non-payment events (subscriptions, etc.) are acknowledged without processing.
    const type = String(payload["type"] ?? "");
    if (type !== "payment") {
      return { orderId: "", status: "unknown", externalId: "", rawPayload: payload };
    }

    const paymentId = String((payload["data"] as Record<string, unknown>)?.["id"] ?? "");
    if (!paymentId) {
      return { orderId: "", status: "unknown", externalId: "", rawPayload: payload };
    }

    const config   = getConfig();
    const response = await fetch(`${MP_API_URL}/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${config.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`MercadoPago API error ${response.status} fetching payment ${paymentId}`);
    }

    const data = (await response.json()) as {
      id:                 number;
      status:             string;
      external_reference: string;
      [k: string]: unknown;
    };

    return {
      orderId:    data.external_reference ?? "",
      status:     mapStatus(data.status),
      externalId: String(data.id),
      rawPayload: data as Record<string, unknown>,
    };
  }
}
