import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  NormalizedWebhook,
  NormalizedStatus,
} from "./payment.provider.js";

function getConfig(): { apiUrl: string; apiKey: string; secretKey: string; commerceId: string } {
  const environment = process.env["PRONTOPAGA_ENVIRONMENT"] ?? "sandbox";
  const apiUrl =
    environment === "production"
      ? (process.env["PRONTOPAGA_API_URL_PROD"]     ?? "https://api.prontopaga.cl/v1")
      : (process.env["PRONTOPAGA_API_URL_SANDBOX"]  ?? "https://sandbox.prontopaga.cl/v1");

  const apiKey     = process.env["PRONTOPAGA_API_KEY"]     ?? "";
  const secretKey  = process.env["PRONTOPAGA_SECRET_KEY"]  ?? "";
  const commerceId = process.env["PRONTOPAGA_COMMERCE_ID"] ?? "";

  if (!apiKey || !secretKey || !commerceId) {
    throw new Error(
      "ProntoPaga credentials not configured (PRONTOPAGA_API_KEY, PRONTOPAGA_SECRET_KEY, PRONTOPAGA_COMMERCE_ID).",
    );
  }

  return { apiUrl, apiKey, secretKey, commerceId };
}

function buildSignature(params: Record<string, string | number>, secretKey: string): string {
  const keys = Object.keys(params).sort();
  const raw  = keys.map(k => `${k}=${params[k]}`).join("&");
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

function mapStatus(ppStatus: string): NormalizedStatus {
  switch (ppStatus) {
    case "success":
    case "approved":
    case "paid":         return "success";
    case "rejected":
    case "failed":
    case "cancelled":    return "rejected";
    default:             return "unknown";
  }
}

export class ProntoPagaProvider implements PaymentProvider {
  readonly name = "prontopaga";

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const config = getConfig();

    const body: Record<string, string | number> = {
      commerce_id:  config.commerceId,
      order_id:     params.orderId,
      amount:       params.amountClp,
      currency:     "CLP",
      description:  params.description,
      email:        params.passengerEmail,
      name:         params.passengerName,
      return_url:   params.returnUrl,
      webhook_url:  params.webhookUrl,
    };

    body["signature"] = buildSignature(body, config.secretKey);

    const response = await fetch(`${config.apiUrl}/payments/create`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ProntoPaga API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { order_id?: string; url_pay?: string; [k: string]: unknown };

    if (!data.url_pay || !data.order_id) {
      throw new Error("ProntoPaga response missing url_pay or order_id.");
    }

    return {
      providerOrderId: String(data.order_id),
      urlPay:          String(data.url_pay),
    };
  }

  verifyWebhookSignature(payload: Record<string, unknown>, _headers: Record<string, string>): boolean {
    try {
      const config            = getConfig();
      const receivedSignature = String(payload["signature"] ?? "");
      if (!receivedSignature) return false;

      const filtered: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (k === "signature") continue;
        if (typeof v === "string" || typeof v === "number") filtered[k] = v;
      }

      const expected = buildSignature(filtered, config.secretKey);
      if (expected.length !== receivedSignature.length) return false;

      return crypto.timingSafeEqual(
        Buffer.from(expected,          "hex"),
        Buffer.from(receivedSignature, "hex"),
      );
    } catch {
      return false;
    }
  }

  async normalizeWebhook(
    payload: Record<string, unknown>,
    _headers: Record<string, string>,
  ): Promise<NormalizedWebhook> {
    const orderId    = String(payload["order"] ?? payload["order_id"] ?? "");
    const externalId = String(payload["external_id"] ?? payload["transaction_id"] ?? "");
    const status     = mapStatus(String(payload["status"] ?? ""));

    return { orderId, status, externalId, rawPayload: payload };
  }
}
