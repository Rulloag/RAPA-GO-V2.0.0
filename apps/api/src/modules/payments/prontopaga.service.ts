import crypto from "node:crypto";

type CreatePaymentInput = {
  rideId: string;
  amountClp: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocument: string;
};

type CreatePaymentResult = {
  urlPay: string;
  uid: string;
  reference: string;
  order: string;
  amountClp: number;
  currency: string;
  country: string;
  status: string;
};

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function requiredEnv(name: string): string {
  const value = env(name);

  if (!value) {
    throw new Error(`Falta ${name} en el .env`);
  }

  return value;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function getPublicBackendUrl(): string {
  return normalizeUrl(
    env("PAYMENT_WEBHOOK_BASE_URL") ||
      `http://localhost:${env("PORT", "3000")}`,
  );
}

function isDemoMode(): boolean {
  const mock = env("PRONTOPAGA_MOCK_MODE").toLowerCase();

  if (mock === "true" || mock === "1" || mock === "yes") {
    return true;
  }

  const apiKey = env("PRONTOPAGA_API_KEY");
  const secret = env("PRONTOPAGA_SECRET_KEY");

  return (
    !apiKey ||
    !secret ||
    apiKey.includes("demo") ||
    secret.includes("demo") ||
    apiKey.startsWith("pp_sandbox_demo")
  );
}

function buildOrderId(rideId: string): string {
  const cleanRideId =
    rideId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "LOCAL";

  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `RAPAGO-${cleanRideId}-${Date.now()}-${suffix}`;
}

function signPayload(
  payload: Record<string, unknown>,
  secretKey: string,
): string {
  const clean = Object.entries(payload)
    .filter(([key, value]) => key !== "sign" && value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const base = clean.map(([key, value]) => `${key}=${value}`).join("&");

  return crypto.createHash("sha256").update(`${base}${secretKey}`).digest("hex");
}

function buildDemoUrl(order: string, amountClp: number): string {
  const base = getPublicBackendUrl();

  const params = new URLSearchParams({
    order,
    amount: String(Math.round(amountClp)),
    currency: env("PRONTOPAGA_CURRENCY", "CLP"),
  });

  return `${base}/api/payments/prontopaga/demo-checkout?${params.toString()}`;
}

async function callProntoPaga(payload: Record<string, unknown>): Promise<{
  urlPay?: string;
  uid?: string;
  reference?: string;
  status?: string;
  message?: string;
  error?: string;
}> {
  const apiUrl = normalizeUrl(requiredEnv("PRONTOPAGA_API_URL"));
  const path = env("PRONTOPAGA_CREATE_PAYMENT_PATH", "/api/payins");
  const endpoint = `${apiUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const apiKey = requiredEnv("PRONTOPAGA_API_KEY");
  const secretKey = requiredEnv("PRONTOPAGA_SECRET_KEY");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      secretKey,
      "secret-key": secretKey,
      "x-secret-key": secretKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data: {
    urlPay?: string;
    uid?: string;
    reference?: string;
    status?: string;
    message?: string;
    error?: string;
  };

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        `ProntoPaga respondió HTTP ${response.status}`,
    );
  }

  return data;
}

export const prontoPagaService = {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!input.rideId?.trim()) {
      throw new Error("rideId es obligatorio.");
    }

    if (!Number.isFinite(Number(input.amountClp)) || Number(input.amountClp) <= 0) {
      throw new Error("amountClp debe ser mayor a 0.");
    }

    const order = buildOrderId(input.rideId);
    const amount = Math.round(Number(input.amountClp));

    const currency = env("PRONTOPAGA_CURRENCY", "CLP");
    const country = env("PRONTOPAGA_COUNTRY", "CL");
    const secretKey = env("PRONTOPAGA_SECRET_KEY", "demo_secret");

    const payloadWithoutSign = {
      currency,
      country,
      amount: String(amount),
      clientName: input.clientName || "Cliente Rapa Go",
      clientEmail: input.clientEmail || "cliente@rapago.cl",
      clientPhone: input.clientPhone || "56900000000",
      clientDocument: input.clientDocument || "11111111-1",
      paymentMethod: env("PRONTOPAGA_CARD_METHOD", "cl_card_payment"),
      urlConfirmation: requiredEnv("PRONTOPAGA_URL_CONFIRMATION"),
      urlFinal: requiredEnv("PRONTOPAGA_URL_FINAL"),
      urlRejected: requiredEnv("PRONTOPAGA_URL_REJECTED"),
      order,
      redirectionTime: env("PRONTOPAGA_REDIRECTION_TIME", "5"),
      theme: {
        bgColor: "transparent",
        mode: "dark",
      },
    };

    const payload = {
      ...payloadWithoutSign,
      sign: signPayload(payloadWithoutSign, secretKey),
    };

    if (isDemoMode()) {
      return {
        urlPay: buildDemoUrl(order, amount),
        uid: `demo-${order}`,
        reference: "DEMO_PRONTOPAGA_LOCAL",
        order,
        amountClp: amount,
        currency,
        country,
        status: "pending",
      };
    }

    const result = await callProntoPaga(payload);

    if (!result.urlPay || !result.uid) {
      throw new Error(
        result.message ||
          result.error ||
          result.reference ||
          "ProntoPaga no devolvió urlPay.",
      );
    }

    return {
      urlPay: result.urlPay,
      uid: result.uid,
      reference: String(result.reference ?? ""),
      order,
      amountClp: amount,
      currency,
      country,
      status: result.status ?? "pending",
    };
  },
};