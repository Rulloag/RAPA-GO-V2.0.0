import crypto from "node:crypto";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { PaymentsRepository, type PaymentPurpose } from "./payments.repository.js";
import { getActiveProvider, getProvider, getKlapEmbeddedProvider } from "./provider.registry.js";
import { AuditService } from "../audit/audit.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreatePaymentInput, CreateKlapEmbeddedOrderInput } from "./payments.schema.js";
import type { NormalizedWebhook } from "./payment.provider.js";
import { KlapProviderError } from "./klap.types.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const paymentsRepo = new PaymentsRepository();
const auditService = new AuditService();

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; code: string; message: string; statusCode: number };
type Result<T> = Ok<T> | Fail;

type PaymentAuthUser = {
  id: string;
  role: string;
  status?: string | null;
  isVerified?: boolean | null;
  verified?: boolean | null;
  driverStatus?: string | null;
  driverApplicationStatus?: string | null;
  applicationStatus?: string | null;
  isDriverApproved?: boolean | null;
  driverApproved?: boolean | null;
  approvedAt?: string | null;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
};

const PAYMENT_ALLOWED_RIDE_STATUSES = new Set([
  "pending_payment",
  "requested",
  "scheduled",
  "driver_scheduled",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "completed",
]);

const RAPAGO_FAST_SEARCH_FEE_CLP = 800;
const RAPAGO_FAST_SEARCH_MARKER = "RAPAGO_FAST_SEARCH_ACTIVE: true";

function getPaymentPurpose(value: unknown): PaymentPurpose {
  return String(value ?? "").trim().toLowerCase() === "fast_search"
    ? "fast_search"
    : "ride";
}

function inferRidePaymentMethod(notes: string | null | undefined): "cash" | "card" | null {
  const text = normalizePaymentText(notes);

  if (
    text.includes("mercadopago") ||
    text.includes("mercado pago") ||
    text.includes("tarjeta") ||
    text.includes("paymentmethod: card")
  ) {
    return "card";
  }

  if (text.includes("efectivo") || text.includes("paymentmethod: cash")) {
    return "cash";
  }

  return null;
}

function rideHasFastSearchActive(notes: string | null | undefined): boolean {
  return String(notes ?? "").includes(RAPAGO_FAST_SEARCH_MARKER);
}

function normalizePaymentText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getRecordString(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): string {
  if (!source) return "";

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
  }

  return "";
}

function getRecordBoolean(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | null {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = normalizePaymentText(value);

      if (["true", "si", "sí", "yes", "1", "approved", "aprobado"].includes(normalized)) {
        return true;
      }

      if (["false", "no", "0", "rejected", "rechazado"].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

function getUserText(user: PaymentAuthUser, keys: string[]): string {
  const base = user as unknown as Record<string, unknown>;

  return (
    getRecordString(base, keys) ||
    getRecordString(user.profile, keys) ||
    getRecordString(user.metadata, keys)
  );
}

function getUserBoolean(user: PaymentAuthUser, keys: string[]): boolean | null {
  const base = user as unknown as Record<string, unknown>;

  return (
    getRecordBoolean(base, keys) ??
    getRecordBoolean(user.profile, keys) ??
    getRecordBoolean(user.metadata, keys)
  );
}

function isDriverApprovedForPassengerPayments(user: PaymentAuthUser): boolean {
  const role = normalizePaymentText(user.role);

  if (role !== "driver" && role !== "conductor") {
    return false;
  }

  const status = normalizePaymentText(
    getUserText(user, [
      "status",
      "driverStatus",
      "driverApplicationStatus",
      "applicationStatus",
      "approvalStatus",
    ]),
  );

  const approvedBoolean =
    getUserBoolean(user, [
      "isVerified",
      "verified",
      "isDriverApproved",
      "driverApproved",
      "approved",
      "canDrive",
      "canReceiveRides",
    ]) === true;

  const hasApprovedDate = Boolean(
    getUserText(user, [
      "approvedAt",
      "driverApprovedAt",
      "verifiedAt",
      "activatedAt",
    ]),
  );

  return (
    approvedBoolean ||
    hasApprovedDate ||
    status === "active" ||
    status === "approved" ||
    status === "aprobado" ||
    status === "verified" ||
    status === "verificado"
  );
}

function canCreatePassengerPayment(user: PaymentAuthUser): boolean {
  const role = normalizePaymentText(user.role);

  if (role === "passenger" || role === "pasajero") return true;
  if (role === "admin" || role === "administrator") return true;
  if (isDriverApprovedForPassengerPayments(user)) return true;

  return false;
}

async function authenticate(
  accessToken: string,
): Promise<Result<{ userId: string; role: string; user: PaymentAuthUser }>> {
  let payload;

  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      };
    }

    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);

  if (!valid) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "Session has been revoked.",
      statusCode: 401,
    };
  }

  const user = (await usersRepo.findById(payload.sub)) as PaymentAuthUser | null;

  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: user.role,
    user,
  };
}

type PaymentReturnMarker =
  | "approved_return"
  | "pending_return"
  | "failure_return";

function getPaymentFrontendReturnUrl(): string {
  const configuredUrl = String(
    process.env["PAYMENT_SUCCESS_URL"] ?? "",
  ).trim();

  if (configuredUrl) return configuredUrl;

  const frontendUrl = String(process.env["FRONTEND_URL"] ?? "").trim();

  if (frontendUrl) {
    return `${frontendUrl.replace(/\/+$/, "")}/passenger/trips`;
  }

  const mobileDeepLink = String(
    process.env["MOBILE_APP_DEEP_LINK"] ?? "rapago://",
  ).trim();

  return `${mobileDeepLink.replace(/\/+$/, "")}/payment/result`;
}

function buildPaymentFrontendResultUrl(input: {
  marker: PaymentReturnMarker;
  externalReference?: string;
  providerPaymentId?: string;
  reason?: string;
}): string {
  const baseUrl = getPaymentFrontendReturnUrl();

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("payment", input.marker);
    url.searchParams.set("backend_reconciled", "1");

    if (input.externalReference) {
      url.searchParams.set("external_reference", input.externalReference);
    }

    if (input.providerPaymentId) {
      url.searchParams.set("payment_id", input.providerPaymentId);
    }

    if (input.reason) {
      url.searchParams.set("reconcile_result", input.reason);
    }

    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const params = new URLSearchParams({
      payment: input.marker,
      backend_reconciled: "1",
      ...(input.externalReference
        ? { external_reference: input.externalReference }
        : {}),
      ...(input.providerPaymentId
        ? { payment_id: input.providerPaymentId }
        : {}),
      ...(input.reason ? { reconcile_result: input.reason } : {}),
    });

    return `${baseUrl}${separator}${params.toString()}`;
  }
}

function buildMercadoPagoBackendReturnUrl(): string {
  const configured = String(
    process.env["PAYMENT_MERCADOPAGO_RETURN_URL"] ?? "",
  ).trim();
  const webhookBase = String(
    process.env["PAYMENT_WEBHOOK_BASE_URL"] ?? "",
  )
    .trim()
    .replace(/\/+$/, "");
  const candidate =
    configured ||
    (webhookBase
      ? `${webhookBase}/api/payments/return/mercadopago`
      : "");

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:") {
      throw new Error("Mercado Pago return URL must use HTTPS.");
    }

    return url.toString();
  } catch {
    throw new Error(
      "Falta una URL HTTPS válida para el regreso de Mercado Pago. Configura PAYMENT_MERCADOPAGO_RETURN_URL o PAYMENT_WEBHOOK_BASE_URL.",
    );
  }
}

function buildPaymentReturnUrl(providerName: string): string {
  return normalizePaymentText(providerName) === "mercadopago"
    ? buildMercadoPagoBackendReturnUrl()
    : buildPaymentFrontendResultUrl({ marker: "pending_return" });
}


function isPaymentRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function getPaymentRecordValue(source: unknown, keys: string[]): unknown {
  let current = source;

  for (const key of keys) {
    if (!isPaymentRecord(current)) return null;
    current = current[key];
  }

  return current;
}

function getPaymentStringValue(source: unknown, keys: string[]): string {
  const value = getPaymentRecordValue(source, keys);

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function extractMercadoPagoPaymentId(payment: Record<string, unknown>): string {
  return (
    getPaymentStringValue(payment, ["providerPaymentId"]) ||
    getPaymentStringValue(payment, ["externalId"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["id"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["data", "id"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["payment_id"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["paymentId"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["externalId"])
  );
}

async function refundMercadoPagoPayment(input: {
  mercadoPagoPaymentId: string;
  idempotencyKey: string;
}): Promise<{
  ok: boolean;
  statusCode: number;
  data: unknown;
}> {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];

  if (!accessToken) {
    return {
      ok: false,
      statusCode: 500,
      data: {
        message: "Falta MERCADOPAGO_ACCESS_TOKEN en el backend.",
      },
    };
  }

  try {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${input.mercadoPagoPaymentId}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({}),
      },
    );

    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      statusCode: response.status,
      data,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 502,
      data: {
        message:
          err instanceof Error
            ? err.message
            : "No fue posible conectar con MercadoPago.",
      },
    };
  }
}

function extractMercadoPagoRefundId(payload: unknown): string | null {
  const id = getPaymentStringValue(payload, ["id"]);
  return id || null;
}

function getMercadoPagoWebhookAmountClp(rawPayload: Record<string, unknown>): number | null {
  const value =
    rawPayload["transaction_amount"] ??
    rawPayload["transactionAmount"] ??
    rawPayload["amount"];
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

function getMercadoPagoWebhookCurrency(rawPayload: Record<string, unknown>): string {
  return String(
    rawPayload["currency_id"] ??
      rawPayload["currency"] ??
      "",
  ).trim().toUpperCase();
}

type MercadoPagoPaymentSnapshot = Record<string, unknown> & {
  id?: string | number;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number | string;
  currency_id?: string;
  date_created?: string;
  date_last_updated?: string;
};

function mapMercadoPagoPaymentStatus(status: unknown): NormalizedWebhook["status"] {
  switch (String(status ?? "").trim().toLowerCase()) {
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

function getMercadoPagoAccessToken(): string {
  const accessToken = String(
    process.env["MERCADOPAGO_ACCESS_TOKEN"] ?? "",
  ).trim();

  if (!accessToken || accessToken.includes("PEGA_AQUI")) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured.");
  }

  return accessToken;
}

async function fetchMercadoPagoPayment(
  providerPaymentId: string,
): Promise<MercadoPagoPaymentSnapshot> {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(providerPaymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      },
    },
  );

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      `MercadoPago API error ${response.status} fetching payment ${providerPaymentId}: ${text}`,
    );
  }

  try {
    return JSON.parse(text) as MercadoPagoPaymentSnapshot;
  } catch {
    throw new Error(
      `MercadoPago returned invalid JSON for payment ${providerPaymentId}.`,
    );
  }
}

async function searchMercadoPagoPaymentByExternalReference(
  externalReference: string,
): Promise<MercadoPagoPaymentSnapshot | null> {
  const params = new URLSearchParams({
    external_reference: externalReference,
    sort: "date_created",
    criteria: "desc",
    limit: "20",
    offset: "0",
  });
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/search?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      },
    },
  );

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      `MercadoPago API error ${response.status} searching external_reference ${externalReference}: ${text}`,
    );
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `MercadoPago returned invalid JSON searching external_reference ${externalReference}.`,
    );
  }

  const results = Array.isArray(parsed["results"])
    ? parsed["results"].filter(
        (item): item is MercadoPagoPaymentSnapshot =>
          Boolean(item && typeof item === "object"),
      )
    : [];

  const exact = results.filter(
    (item) =>
      String(item.external_reference ?? "").trim() === externalReference,
  );

  return (
    exact.find(
      (item) => mapMercadoPagoPaymentStatus(item.status) === "success",
    ) ??
    exact[0] ??
    null
  );
}

function getMercadoPagoSnapshotAmountClp(
  payment: MercadoPagoPaymentSnapshot,
): number | null {
  const amount = Number(payment.transaction_amount);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

function getMercadoPagoSnapshotCurrency(
  payment: MercadoPagoPaymentSnapshot,
): string {
  return String(payment.currency_id ?? "").trim().toUpperCase();
}

async function activateRideAfterApprovedPayment(
  rideRequestId: string,
): Promise<boolean> {
  const { RidesRepository } = await import("../rides/rides.repository.js");
  const repo = new RidesRepository() as {
    activateAfterApprovedPayment?: (id: string) => Promise<unknown>;
    findById?: (id: string) => Promise<{ status?: string | null } | null>;
  };

  if (typeof repo.activateAfterApprovedPayment !== "function") {
    return false;
  }

  const activated = await repo.activateAfterApprovedPayment(rideRequestId);
  if (activated) return true;

  if (typeof repo.findById === "function") {
    const current = await repo.findById(rideRequestId);
    const currentStatus = String(current?.status ?? "").trim().toLowerCase();

    return Boolean(
      current &&
        currentStatus &&
        currentStatus !== "pending_payment" &&
        currentStatus !== "cancelled",
    );
  }

  return false;
}

async function cancelRideAfterRejectedPayment(
  rideRequestId: string,
  reason: string,
): Promise<void> {
  const { RidesRepository } = await import("../rides/rides.repository.js");
  const repo = new RidesRepository() as {
    cancelPendingPayment?: (id: string, reason: string) => Promise<unknown>;
  };

  if (typeof repo.cancelPendingPayment === "function") {
    await repo.cancelPendingPayment(rideRequestId, reason);
  }
}

async function activateFastSearchAfterPayment(
  rideRequestId: string,
  paymentMethod: "cash" | "card",
): Promise<void> {
  const { RidesRepository } = await import("../rides/rides.repository.js");
  const repo = new RidesRepository() as {
    activateFastSearch?: (
      id: string,
      feeClp: number,
      method: "cash" | "card",
    ) => Promise<unknown>;
  };

  if (typeof repo.activateFastSearch !== "function") {
    throw new Error("RidesRepository.activateFastSearch is not available.");
  }

  await repo.activateFastSearch(
    rideRequestId,
    RAPAGO_FAST_SEARCH_FEE_CLP,
    paymentMethod,
  );
}


function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function getWebhookEventIdentity(
  providerName: string,
  payload: Record<string, unknown>,
  headers: Record<string, string>,
): {
  eventKey: string;
  payloadHash: string;
  requestId: string | null;
  action: string | null;
} {
  const payloadHash = crypto
    .createHash("sha256")
    .update(stableJson(payload))
    .digest("hex");
  const data = payload["data"];
  const dataId = data && typeof data === "object"
    ? getPaymentStringValue(data, ["id"])
    : "";
  const requestId = String(headers["x-request-id"] ?? "").trim() || null;
  const providerReference =
    dataId ||
    getPaymentStringValue(payload, [
      "id",
      "transaction_id",
      "external_id",
      "order",
      "order_id",
    ]);
  const action = getPaymentStringValue(payload, ["action", "type", "status"]) || null;
  const identity = [requestId, providerReference, action]
    .filter(Boolean)
    .join(":") || payloadHash;
  return {
    eventKey: crypto
      .createHash("sha256")
      .update(`${providerName}:${identity}:${payloadHash}`)
      .digest("hex"),
    payloadHash,
    requestId,
    action,
  };
}

function buildReceiptNumber(paymentId: string, createdAt: Date): string {
  const date = createdAt.toISOString().slice(0, 10).replaceAll("-", "");
  return `RPG-${date}-${paymentId.slice(0, 8).toUpperCase()}`;
}

type MercadoPagoReconciliationPayment = {
  id: string;
  rideRequestId: string;
  status: string;
  paymentPurpose: PaymentPurpose;
  providerPaymentId: string | null;
  activated: boolean;
  reconciled: boolean;
};

type StoredPayment = NonNullable<
  Awaited<ReturnType<PaymentsRepository["findById"]>>
>;

async function reconcileStoredMercadoPagoPayment(
  payment: StoredPayment,
  providerPaymentId?: string,
): Promise<Result<{ payment: MercadoPagoReconciliationPayment }>> {
  const paymentPurpose = getPaymentPurpose(payment.paymentPurpose);
  let activated = false;

  if (payment.status === "success") {
    try {
      if (paymentPurpose === "fast_search") {
        await activateFastSearchAfterPayment(payment.rideRequestId, "card");
      } else {
        activated = await activateRideAfterApprovedPayment(
          payment.rideRequestId,
        );
      }

      if (paymentPurpose === "fast_search") {
        activated = true;
      }
    } catch (err) {
      console.warn("[MercadoPago] Pago ya aprobado, pero la reactivación no terminó:", {
        paymentId: payment.id,
        rideRequestId: payment.rideRequestId,
        error: String(err),
      });
    }

    return {
      ok: true,
      payment: {
        id: payment.id,
        rideRequestId: payment.rideRequestId,
        status: payment.status,
        paymentPurpose,
        providerPaymentId: payment.providerPaymentId ?? null,
        activated,
        reconciled: false,
      },
    };
  }

  let providerPayment: MercadoPagoPaymentSnapshot | null = null;

  try {
    const normalizedProviderPaymentId = String(
      providerPaymentId ?? "",
    ).trim();

    if (normalizedProviderPaymentId) {
      if (!/^\d+$/.test(normalizedProviderPaymentId)) {
        return {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "providerPaymentId must contain only digits.",
          statusCode: 400,
        };
      }

      providerPayment = await fetchMercadoPagoPayment(
        normalizedProviderPaymentId,
      );
    } else {
      providerPayment = await searchMercadoPagoPaymentByExternalReference(
        payment.id,
      );
    }
  } catch (err) {
    console.error("[MercadoPago] Falló la conciliación con la API:", {
      paymentId: payment.id,
      rideRequestId: payment.rideRequestId,
      hasProviderPaymentId: Boolean(providerPaymentId),
      error: String(err),
    });

    return {
      ok: false,
      code: "PAYMENT_RECONCILIATION_PROVIDER_ERROR",
      message:
        "No se pudo consultar el pago directamente en Mercado Pago. Intenta actualizar nuevamente.",
      statusCode: 502,
    };
  }

  if (!providerPayment) {
    return {
      ok: true,
      payment: {
        id: payment.id,
        rideRequestId: payment.rideRequestId,
        status: payment.status,
        paymentPurpose,
        providerPaymentId: payment.providerPaymentId ?? null,
        activated: false,
        reconciled: false,
      },
    };
  }

  const externalReference = String(
    providerPayment.external_reference ?? "",
  ).trim();
  const resolvedProviderPaymentId = String(
    providerPayment.id ?? providerPaymentId ?? "",
  ).trim();

  if (externalReference !== payment.id) {
    console.warn("[MercadoPago] Conciliación rechazada por external_reference:", {
      paymentId: payment.id,
      providerPaymentId: resolvedProviderPaymentId || null,
      externalReference: externalReference || null,
    });
    return {
      ok: false,
      code: "PAYMENT_EXTERNAL_REFERENCE_MISMATCH",
      message: "El pago de Mercado Pago no corresponde a esta solicitud.",
      statusCode: 409,
    };
  }

  const normalizedStatus = mapMercadoPagoPaymentStatus(
    providerPayment.status,
  );
  const paidAmountClp = getMercadoPagoSnapshotAmountClp(providerPayment);
  const currency = getMercadoPagoSnapshotCurrency(providerPayment);
  const expectedAmountClp = Math.round(Number(payment.amountClp));
  const amountMatches =
    paidAmountClp != null && paidAmountClp === expectedAmountClp;
  const currencyMatches = !currency || currency === "CLP";

  console.log("[MercadoPago] Conciliación segura:", {
    paymentId: payment.id,
    rideRequestId: payment.rideRequestId,
    providerPaymentId: resolvedProviderPaymentId || null,
    providerStatus: String(providerPayment.status ?? ""),
    normalizedStatus,
    expectedAmountClp,
    paidAmountClp,
    currency: currency || null,
  });

  if (normalizedStatus === "success") {
    if (!amountMatches || !currencyMatches) {
      return {
        ok: false,
        code: "PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH",
        message:
          "El monto o la moneda informada por Mercado Pago no coincide con la solicitud.",
        statusCode: 409,
      };
    }

    try {
      if (paymentPurpose === "fast_search") {
        await paymentsRepo.markSuccess(
          payment.id,
          resolvedProviderPaymentId,
          providerPayment,
        );
        await activateFastSearchAfterPayment(payment.rideRequestId, "card");
        activated = true;
      } else {
        const confirmed = await paymentsRepo.markSuccessAndActivateRide({
          id: payment.id,
          rideRequestId: payment.rideRequestId,
          externalId: resolvedProviderPaymentId,
          providerPayload: providerPayment,
        });
        activated = confirmed.rideActivated;
      }

      if (!activated) {
        throw new Error(
          "El viaje no salió de pending_payment después de confirmar el pago.",
        );
      }
    } catch (err) {
      console.error("[MercadoPago] Pago conciliado, pero falló la activación:", {
        paymentId: payment.id,
        rideRequestId: payment.rideRequestId,
        error: String(err),
      });

      return {
        ok: false,
        code: "PAYMENT_APPROVED_RIDE_ACTIVATION_ERROR",
        message:
          "El pago fue confirmado, pero el viaje no pudo activarse automáticamente. No vuelvas a pagar.",
        statusCode: 500,
      };
    }

    auditService.recordSafe({
      actorUserId: payment.passengerUserId,
      eventType: "payment.reconciled_success",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        rideId: payment.rideRequestId,
        amountClp: payment.amountClp,
        providerPaymentId: resolvedProviderPaymentId,
        paymentPurpose,
      },
    });

    return {
      ok: true,
      payment: {
        id: payment.id,
        rideRequestId: payment.rideRequestId,
        status: "success",
        paymentPurpose,
        providerPaymentId: resolvedProviderPaymentId || null,
        activated,
        reconciled: true,
      },
    };
  }

  if (normalizedStatus === "rejected") {
    await paymentsRepo.markRejected(payment.id, providerPayment);

    if (paymentPurpose === "ride") {
      try {
        await cancelRideAfterRejectedPayment(
          payment.rideRequestId,
          "Mercado Pago informó que el pago fue rechazado o cancelado.",
        );
      } catch {
        // La conciliación del pago sigue siendo la autoridad.
      }
    }

    return {
      ok: true,
      payment: {
        id: payment.id,
        rideRequestId: payment.rideRequestId,
        status: "rejected",
        paymentPurpose,
        providerPaymentId: resolvedProviderPaymentId || null,
        activated: false,
        reconciled: true,
      },
    };
  }

  return {
    ok: true,
    payment: {
      id: payment.id,
      rideRequestId: payment.rideRequestId,
      status: payment.status,
      paymentPurpose,
      providerPaymentId: resolvedProviderPaymentId || null,
      activated: false,
      reconciled: true,
    },
  };
}

export class PaymentsService {
  async createPayment(
    accessToken: string,
    input: CreatePaymentInput,
  ): Promise<Result<{
    urlPay: string;
    paymentId: string;
    paymentPurpose: PaymentPurpose;
    activated: boolean;
  }>> {
    const auth = await authenticate(accessToken);

    if (!auth.ok) return auth;

    if (!canCreatePassengerPayment(auth.user)) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Solo pasajeros, conductores aprobados usando vista pasajero o administradores pueden crear pagos.",
        statusCode: 403,
      };
    }

    const { RidesRepository } = await import("../rides/rides.repository.js");
    const ridesRepo = new RidesRepository();
    const ride = await ridesRepo.findById(input.rideRequestId);

    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    const isAdmin =
      normalizePaymentText(auth.role) === "admin" ||
      normalizePaymentText(auth.role) === "administrator";

    if (!isAdmin && ride.passengerUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "This ride does not belong to you.",
        statusCode: 403,
      };
    }

    const paymentPurpose = getPaymentPurpose(input.paymentPurpose);

    if (!PAYMENT_ALLOWED_RIDE_STATUSES.has(String(ride.status ?? ""))) {
      return {
        ok: false,
        code: "PAYMENT_RIDE_STATUS_NOT_ALLOWED",
        message:
          "Payment can only be initiated for an active, scheduled, in-progress or completed ride.",
        statusCode: 409,
      };
    }

    if (paymentPurpose === "fast_search" && String(ride.status) !== "requested") {
      return {
        ok: false,
        code: "FAST_SEARCH_STATUS_NOT_ALLOWED",
        message:
          "RapaGo más veloz solo se puede activar mientras el viaje está buscando conductor.",
        statusCode: 409,
      };
    }

    if (paymentPurpose === "fast_search" && rideHasFastSearchActive(ride.notes)) {
      return {
        ok: false,
        code: "FAST_SEARCH_ALREADY_ACTIVE",
        message: "RapaGo más veloz ya está activo para este viaje.",
        statusCode: 409,
      };
    }

    const successful = await paymentsRepo.findSuccessfulByRideIdAndPurpose(
      input.rideRequestId,
      paymentPurpose,
    );

    if (successful) {
      return {
        ok: false,
        code:
          paymentPurpose === "fast_search"
            ? "FAST_SEARCH_ALREADY_PAID"
            : "PAYMENT_ALREADY_PAID",
        message:
          paymentPurpose === "fast_search"
            ? "El recargo de RapaGo más veloz ya fue pagado."
            : "Este viaje ya tiene un pago aprobado.",
        statusCode: 409,
      };
    }

    const active = await paymentsRepo.findActiveByRideIdAndPurpose(
      input.rideRequestId,
      paymentPurpose,
    );

    if (active) {
      return {
        ok: false,
        code: "PAYMENT_ALREADY_EXISTS",
        message:
          paymentPurpose === "fast_search"
            ? "El pago de RapaGo más veloz ya está pendiente o procesándose."
            : "A payment for this ride is already pending or processing.",
        statusCode: 409,
      };
    }

    const ridePaymentMethod = inferRidePaymentMethod(ride.notes);

    if (paymentPurpose === "fast_search" && !ridePaymentMethod) {
      return {
        ok: false,
        code: "FAST_SEARCH_PAYMENT_METHOD_UNKNOWN",
        message:
          "No pudimos identificar si el viaje fue solicitado en efectivo o con Mercado Pago.",
        statusCode: 422,
      };
    }

    if (paymentPurpose === "fast_search" && ridePaymentMethod === "cash") {
      const cashPayment = await paymentsRepo.create({
        rideRequestId: ride.id,
        passengerUserId: auth.userId,
        amountClp: RAPAGO_FAST_SEARCH_FEE_CLP,
        paymentPurpose: "fast_search",
        status: "processing",
        provider: "cash",
        providerOrderId: `cash-fast-search-${ride.id}`,
        providerPaymentId: `cash-fast-search-${crypto.randomUUID()}`,
        rawProviderPayload: {
          source: "rapago_fast_search_cash",
          priorityStatus: "approved",
          collectionStatus: "pay_on_completion",
          amountClp: RAPAGO_FAST_SEARCH_FEE_CLP,
          activatedAt: new Date().toISOString(),
        },
      });

      try {
        await activateFastSearchAfterPayment(ride.id, "cash");
      } catch (err) {
        await paymentsRepo.markFailed(cashPayment.id);
        return {
          ok: false,
          code: "FAST_SEARCH_ACTIVATION_ERROR",
          message: "No se pudo activar RapaGo más veloz. Intenta nuevamente.",
          statusCode: 500,
        };
      }

      auditService.recordSafe({
        actorUserId: auth.userId,
        eventType: "payment.fast_search_cash_activated",
        entityType: "payment",
        entityId: cashPayment.id,
        metadata: {
          rideId: ride.id,
          amountClp: RAPAGO_FAST_SEARCH_FEE_CLP,
          paymentPurpose: "fast_search",
          actorRole: auth.role,
        },
      });

      return {
        ok: true,
        urlPay: "",
        paymentId: cashPayment.id,
        paymentPurpose: "fast_search",
        activated: true,
      };
    }

    if (paymentPurpose === "fast_search" && ridePaymentMethod === "card") {
      const approvedRidePayment = await paymentsRepo.findSuccessfulByRideId(ride.id);

      if (!approvedRidePayment) {
        return {
          ok: false,
          code: "RIDE_PAYMENT_NOT_APPROVED",
          message:
            "El pago principal del viaje todavía no está aprobado por Mercado Pago.",
          statusCode: 409,
        };
      }
    }

    const amountClp =
      paymentPurpose === "fast_search"
        ? RAPAGO_FAST_SEARCH_FEE_CLP
        : Math.max(0, Math.round(Number(ride.estimatedFareClp ?? 0)));

    if (amountClp <= 0) {
      return {
        ok: false,
        code: "PAYMENT_INVALID_AMOUNT",
        message: "Ride has no valid fare amount.",
        statusCode: 422,
      };
    }

    const user = await usersRepo.findById(auth.userId);
    const provider = getActiveProvider();

    const payment = await paymentsRepo.create({
      rideRequestId: ride.id,
      passengerUserId: auth.userId,
      amountClp,
      paymentPurpose,
      status: "pending",
      provider: provider.name,
    });

    const webhookBaseUrl = process.env["PAYMENT_WEBHOOK_BASE_URL"] ?? "";

    let providerOrderId: string;
    let urlPay: string;

    try {
      const result = await provider.createPayment({
        orderId: payment.id,
        amountClp,
        description:
          paymentPurpose === "fast_search"
            ? `RapaGo más veloz — ${ride.originText} → ${ride.destinationText}`
            : `Viaje Rapa Go — ${ride.originText} → ${ride.destinationText}`,
        passengerEmail: user?.email ?? "",
        passengerName: user?.name ?? "Pasajero",
        returnUrl: buildPaymentReturnUrl(provider.name),
        webhookUrl: `${webhookBaseUrl.replace(/\/+$/, "")}/api/payments/webhook/${provider.name}`,
      });

      providerOrderId = result.providerOrderId;
      urlPay = result.urlPay;
    } catch (err) {
      await paymentsRepo.markFailed(payment.id);

      if (paymentPurpose === "ride") {
        try {
          await ridesRepo.cancelPendingPayment(
            ride.id,
            "No se pudo iniciar el pago con Mercado Pago.",
          );
        } catch {
          // El error del proveedor sigue siendo la respuesta principal.
        }
      }

      auditService.recordSafe({
        actorUserId: auth.userId,
        eventType: "payment.provider_error",
        entityType: "payment",
        entityId: payment.id,
        metadata: {
          error: String(err),
          rideId: ride.id,
          provider: provider.name,
          paymentPurpose,
        },
      });

      return {
        ok: false,
        code: "PAYMENT_PROVIDER_ERROR",
        message:
          paymentPurpose === "fast_search"
            ? "No se pudo iniciar el pago de RapaGo más veloz. Intenta nuevamente."
            : "Could not initiate payment with provider. Please try again.",
        statusCode: 502,
      };
    }

    await paymentsRepo.markProcessing(payment.id, urlPay, providerOrderId);

    auditService.recordSafe({
      actorUserId: auth.userId,
      eventType: "payment.created",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        rideId: ride.id,
        amountClp,
        provider: provider.name,
        actorRole: auth.role,
        paymentPurpose,
      },
    });

    return {
      ok: true,
      urlPay,
      paymentId: payment.id,
      paymentPurpose,
      activated: false,
    };
  }

  /**
   * Klap Checkout Transparente — Sandbox-only embedded order creation (Fase D).
   *
   * Separate from `createPayment()` above on purpose: Klap is embedded, not
   * redirect-based (see the discriminated-union note in payment.provider.ts), and
   * is not wired into `getActiveProvider()`/`PAYMENT_PROVIDER` — reaching it
   * requires this method specifically, called from its own dedicated route.
   *
   * Creating the order here is NOT a successful payment. The local `payments` row
   * stays in the same "processing" state Mercado Pago/ProntoPaga use right after
   * creating their checkout (pending confirmation) — the ride is never activated,
   * no receipt is generated, Wallet is never touched, and no success notification
   * is sent. Real financial confirmation is exclusively the webhook's job, to be
   * implemented in a later phase.
   */
  async createKlapEmbeddedOrder(
    accessToken: string,
    input: CreateKlapEmbeddedOrderInput,
  ): Promise<Result<{
    paymentId: string;
    provider: "klap";
    checkoutType: "embedded";
    publicCheckoutData: { orderId: string };
  }>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!canCreatePassengerPayment(auth.user)) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Solo pasajeros, conductores aprobados usando vista pasajero o administradores pueden crear pagos.",
        statusCode: 403,
      };
    }

    const { RidesRepository } = await import("../rides/rides.repository.js");
    const ridesRepo = new RidesRepository();
    const ride = await ridesRepo.findById(input.rideRequestId);

    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    const isAdmin =
      normalizePaymentText(auth.role) === "admin" ||
      normalizePaymentText(auth.role) === "administrator";

    if (!isAdmin && ride.passengerUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "This ride does not belong to you.",
        statusCode: 403,
      };
    }

    if (!PAYMENT_ALLOWED_RIDE_STATUSES.has(String(ride.status ?? ""))) {
      return {
        ok: false,
        code: "PAYMENT_RIDE_STATUS_NOT_ALLOWED",
        message:
          "Payment can only be initiated for an active, scheduled, in-progress or completed ride.",
        statusCode: 409,
      };
    }

    // Sandbox-only, "ride" purpose only in this phase — fast_search/cash branches
    // are intentionally out of scope for the Klap embedded flow (Fase D).
    const successful = await paymentsRepo.findSuccessfulByRideIdAndPurpose(
      input.rideRequestId,
      "ride",
    );

    if (successful) {
      return {
        ok: false,
        code: "PAYMENT_ALREADY_PAID",
        message: "Este viaje ya tiene un pago aprobado.",
        statusCode: 409,
      };
    }

    const active = await paymentsRepo.findActiveByRideIdAndPurpose(input.rideRequestId, "ride");

    if (active) {
      return {
        ok: false,
        code: "PAYMENT_ALREADY_EXISTS",
        message: "A payment for this ride is already pending or processing.",
        statusCode: 409,
      };
    }

    // Authoritative amount — computed server-side from the ride record, exactly
    // like createPayment() above. The request body has no amount field at all
    // (see createKlapEmbeddedOrderSchema): there is nothing for the client to
    // manipulate here even in principle.
    const amountClp = Math.max(0, Math.round(Number(ride.estimatedFareClp ?? 0)));

    if (!Number.isInteger(amountClp) || amountClp <= 0) {
      return {
        ok: false,
        code: "PAYMENT_INVALID_AMOUNT",
        message: "Ride has no valid fare amount.",
        statusCode: 422,
      };
    }

    const user = await usersRepo.findById(auth.userId);

    const payment = await paymentsRepo.create({
      rideRequestId: ride.id,
      passengerUserId: auth.userId,
      amountClp,
      paymentPurpose: "ride",
      status: "pending",
      provider: "klap",
    });

    const webhookBaseUrl = process.env["PAYMENT_WEBHOOK_BASE_URL"] ?? "";
    const provider = getKlapEmbeddedProvider();

    let embeddedResult;

    try {
      embeddedResult = await provider.createEmbeddedOrder({
        orderId: payment.id,
        amountClp,
        description: `Viaje Rapa Go — ${ride.originText} → ${ride.destinationText}`,
        passengerEmail: user?.email ?? "",
        passengerName: user?.name ?? "Pasajero",
        // Not read by KlapProvider.createEmbeddedOrder today (Checkout Transparente
        // does not redirect); kept consistent with the other providers' call shape
        // in case a confirmed schema field needs them in a later phase.
        returnUrl: buildPaymentReturnUrl("klap"),
        webhookUrl: `${webhookBaseUrl.replace(/\/+$/, "")}/api/payments/webhook/klap`,
      });
    } catch (err) {
      await paymentsRepo.markFailed(payment.id);

      // Timeout/network/http_rejected all land here without a second automatic
      // attempt — the local payment stays "failed" and reconciliable; the caller
      // must explicitly retry (which creates a new payment row with a new
      // deterministic Idempotency-Key), never an implicit second order.
      auditService.recordSafe({
        actorUserId: auth.userId,
        eventType: "payment.klap_provider_error",
        entityType: "payment",
        entityId: payment.id,
        metadata: {
          errorKind: err instanceof KlapProviderError ? err.kind : "unknown",
          rideId: ride.id,
          provider: "klap",
          actorRole: auth.role,
        },
      });

      return {
        ok: false,
        code: "PAYMENT_PROVIDER_ERROR",
        message: "No se pudo iniciar el pago con Klap. Intenta nuevamente.",
        statusCode: 502,
      };
    }

    // Klap has no redirect URL — `urlPay` is a nullable DB column that simply does
    // not apply to an embedded provider. This is a storage detail only: the API
    // response below never includes `urlPay` in any form.
    await paymentsRepo.markProcessing(payment.id, "", embeddedResult.providerOrderId);

    auditService.recordSafe({
      actorUserId: auth.userId,
      eventType: "payment.klap_order_created",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        rideId: ride.id,
        amountClp,
        provider: "klap",
        actorRole: auth.role,
      },
    });

    return {
      ok: true,
      paymentId: payment.id,
      provider: "klap",
      checkoutType: "embedded",
      publicCheckoutData: embeddedResult.publicCheckoutData,
    };
  }

  async reconcileMercadoPagoPayment(
    accessToken: string,
    paymentId: string,
    providerPaymentId?: string,
  ): Promise<Result<{ payment: MercadoPagoReconciliationPayment }>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const payment = await paymentsRepo.findById(paymentId);
    if (!payment) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Payment not found.",
        statusCode: 404,
      };
    }

    const isAdmin = ["admin", "administrator"].includes(
      normalizePaymentText(auth.role),
    );

    if (!isAdmin && payment.passengerUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "This payment does not belong to you.",
        statusCode: 403,
      };
    }

    if (normalizePaymentText(payment.provider) !== "mercadopago") {
      return {
        ok: false,
        code: "PAYMENT_PROVIDER_MISMATCH",
        message: "This payment was not created with Mercado Pago.",
        statusCode: 409,
      };
    }

    return reconcileStoredMercadoPagoPayment(payment, providerPaymentId);
  }

  async reconcileMercadoPagoReturn(
    externalReference: string,
    providerPaymentId?: string,
  ): Promise<Result<{ payment: MercadoPagoReconciliationPayment }>> {
    const paymentId = String(externalReference ?? "").trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        paymentId,
      )
    ) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "external_reference must be a valid payment UUID.",
        statusCode: 400,
      };
    }

    const payment = await paymentsRepo.findById(paymentId);
    if (!payment) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Payment not found.",
        statusCode: 404,
      };
    }

    if (normalizePaymentText(payment.provider) !== "mercadopago") {
      return {
        ok: false,
        code: "PAYMENT_PROVIDER_MISMATCH",
        message: "This payment was not created with Mercado Pago.",
        statusCode: 409,
      };
    }

    return reconcileStoredMercadoPagoPayment(payment, providerPaymentId);
  }

  async resolveMercadoPagoBrowserReturn(input: {
    externalReference?: string;
    providerPaymentId?: string;
  }): Promise<{ redirectUrl: string }> {
    const externalReference = String(
      input.externalReference ?? "",
    ).trim();
    const providerPaymentId = String(
      input.providerPaymentId ?? "",
    ).trim();

    let marker: PaymentReturnMarker = "pending_return";
    let reason = "pending";

    try {
      const result = await this.reconcileMercadoPagoReturn(
        externalReference,
        providerPaymentId || undefined,
      );

      if (result.ok) {
        const status = normalizePaymentText(result.payment.status);

        if (status === "success" && result.payment.activated) {
          marker = "approved_return";
          reason = "approved";
        } else if (
          ["rejected", "failed", "refunded", "cancelled"].includes(status)
        ) {
          marker = "failure_return";
          reason = status || "rejected";
        } else {
          marker = "pending_return";
          reason = status || "pending";
        }
      } else if (
        ["NOT_FOUND", "VALIDATION_ERROR", "PAYMENT_PROVIDER_MISMATCH"].includes(
          result.code,
        )
      ) {
        marker = "failure_return";
        reason = result.code.toLowerCase();
      } else {
        marker = "pending_return";
        reason = result.code.toLowerCase();
      }
    } catch (error) {
      console.error("[MercadoPago] Error resolviendo regreso del navegador:", {
        externalReference: externalReference || null,
        providerPaymentId: providerPaymentId || null,
        error: String(error),
      });
      marker = "pending_return";
      reason = "provider_error";
    }

    console.log("[MercadoPago] Regreso del navegador resuelto:", {
      externalReference: externalReference || null,
      providerPaymentId: providerPaymentId || null,
      marker,
      reason,
    });

    return {
      redirectUrl: buildPaymentFrontendResultUrl({
        marker,
        ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          externalReference,
        )
          ? { externalReference }
          : {}),
        ...(/^\d+$/.test(providerPaymentId)
          ? { providerPaymentId }
          : {}),
        reason,
      }),
    };
  }


  async getPaymentStatus(
    accessToken: string,
    paymentId: string,
  ): Promise<Result<{
    payment: {
      id: string;
      rideRequestId: string;
      status: string;
      paymentPurpose: PaymentPurpose;
      amountClp: number;
      provider: string;
      paidAt: string | null;
      rejectedAt: string | null;
      failedAt: string | null;
      providerOrderId: string | null;
      providerPaymentId: string | null;
      refundStatus: string | null;
      refundProviderId: string | null;
      refundedAt: string | null;
      receiptNumber: string;
      createdAt: string;
      updatedAt: string;
    };
  }>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const payment = await paymentsRepo.findById(paymentId);
    if (!payment) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Payment not found.",
        statusCode: 404,
      };
    }

    const isAdmin = ["admin", "administrator"].includes(
      normalizePaymentText(auth.role),
    );

    if (!isAdmin && payment.passengerUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "This payment does not belong to you.",
        statusCode: 403,
      };
    }

    return {
      ok: true,
      payment: {
        id: payment.id,
        rideRequestId: payment.rideRequestId,
        status: payment.status,
        paymentPurpose: getPaymentPurpose(payment.paymentPurpose),
        amountClp: payment.amountClp,
        provider: payment.provider,
        paidAt: payment.paidAt?.toISOString() ?? null,
        rejectedAt: payment.rejectedAt?.toISOString() ?? null,
        failedAt: payment.failedAt?.toISOString() ?? null,
        providerOrderId: payment.providerOrderId ?? null,
        providerPaymentId: payment.providerPaymentId ?? null,
        refundStatus: payment.refundStatus ?? null,
        refundProviderId: payment.refundProviderId ?? null,
        refundedAt: payment.refundedAt?.toISOString() ?? null,
        receiptNumber: buildReceiptNumber(payment.id, payment.createdAt),
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      },
    };
  }


  async getPaymentReceipt(
    accessToken: string,
    paymentId: string,
  ): Promise<Result<{ receipt: Record<string, unknown> }>> {
    const statusResult = await this.getPaymentStatus(accessToken, paymentId);
    if (!statusResult.ok) return statusResult;
    const payment = statusResult.payment;
    return {
      ok: true,
      receipt: {
        receiptNumber: payment.receiptNumber,
        paymentId: payment.id,
        rideRequestId: payment.rideRequestId,
        paymentPurpose: payment.paymentPurpose,
        amountClp: payment.amountClp,
        currency: "CLP",
        provider: payment.provider,
        status: payment.status,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
        refundStatus: payment.refundStatus,
        refundProviderId: payment.refundProviderId,
        paidAt: payment.paidAt,
        refundedAt: payment.refundedAt,
        issuedAt: payment.updatedAt,
      },
    };
  }

  async refundCardPaymentForCancelledRide(input: {
    rideRequestId: string;
    cancelledByUserId: string;
    cancelledByRole: string;
    reason?: string | null;
  }): Promise<Result<{
    processed: boolean;
    refunded: boolean;
    skippedReason?: string;
    paymentId?: string;
    mercadoPagoPaymentId?: string;
    refund?: unknown;
  }>> {
    const payment = await paymentsRepo.findRefundableByRideId(
      input.rideRequestId,
    );

    if (!payment) {
      return {
        ok: true,
        processed: false,
        refunded: false,
        skippedReason:
          "No existe un pago aprobado para devolver en este viaje.",
      };
    }

    if (normalizePaymentText(payment.provider) !== "mercadopago") {
      return {
        ok: true,
        processed: false,
        refunded: false,
        skippedReason:
          "El pago aprobado no fue realizado con MercadoPago.",
        paymentId: payment.id,
      };
    }

    const mercadoPagoPaymentId = extractMercadoPagoPaymentId(
      payment as unknown as Record<string, unknown>,
    );

    if (
      payment.status === "refunded" ||
      payment.refundStatus === "approved"
    ) {
      return {
        ok: true,
        processed: true,
        refunded: true,
        skippedReason: "Este pago ya fue devuelto anteriormente.",
        paymentId: payment.id,
        mercadoPagoPaymentId,
      };
    }

    if (!mercadoPagoPaymentId) {
      return {
        ok: false,
        code: "REFUND_MISSING_MERCADOPAGO_ID",
        message:
          "El pago no tiene providerPaymentId de MercadoPago para devolver.",
        statusCode: 409,
      };
    }

    if (payment.refundStatus === "processing") {
      return {
        ok: true,
        processed: true,
        refunded: false,
        skippedReason:
          "La devolución de este pago ya está siendo procesada.",
        paymentId: payment.id,
        mercadoPagoPaymentId,
      };
    }

    // Clave estable: un mismo pago siempre usa exactamente la misma operación
    // idempotente ante reintentos, timeouts o llamadas duplicadas.
    const idempotencyKey = `rapago-refund-${payment.id}`;
    const claimed = await paymentsRepo.claimRefund(
      payment.id,
      idempotencyKey,
    );

    if (!claimed) {
      const current = await paymentsRepo.findById(payment.id);

      if (
        current?.status === "refunded" ||
        current?.refundStatus === "approved"
      ) {
        return {
          ok: true,
          processed: true,
          refunded: true,
          skippedReason: "Este pago ya fue devuelto anteriormente.",
          paymentId: payment.id,
          mercadoPagoPaymentId,
        };
      }

      return {
        ok: true,
        processed: true,
        refunded: false,
        skippedReason:
          "Otra solicitud ya está procesando la devolución.",
        paymentId: payment.id,
        mercadoPagoPaymentId,
      };
    }

    const refundResult = await refundMercadoPagoPayment({
      mercadoPagoPaymentId,
      idempotencyKey,
    });

    if (!refundResult.ok) {
      const providerMessage =
        getPaymentStringValue(refundResult.data, ["message"]) ||
        getPaymentStringValue(refundResult.data, ["error"]) ||
        `MercadoPago respondió HTTP ${refundResult.statusCode}.`;

      await paymentsRepo.markRefundFailed({
        id: payment.id,
        reason: providerMessage,
        refundPayload: refundResult.data,
      });

      auditService.recordSafe({
        actorUserId: input.cancelledByUserId,
        eventType: "payment.refund_failed_on_cancel",
        entityType: "payment",
        entityId: payment.id,
        metadata: {
          rideId: input.rideRequestId,
          provider: "mercadopago",
          mercadoPagoPaymentId,
          idempotencyKey,
          statusCode: String(refundResult.statusCode),
          cancelledByRole: input.cancelledByRole,
          reason: input.reason ?? "",
        } as Record<string, string>,
      });

      return {
        ok: false,
        code: "MERCADOPAGO_REFUND_ERROR",
        message:
          "El viaje fue cancelado, pero MercadoPago no pudo procesar la devolución.",
        statusCode: refundResult.statusCode,
      };
    }

    await paymentsRepo.markRefunded({
      id: payment.id,
      providerRefundId: extractMercadoPagoRefundId(refundResult.data),
      refundPayload: refundResult.data,
    });

    auditService.recordSafe({
      actorUserId: input.cancelledByUserId,
      eventType: "payment.refunded_on_cancel",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        rideId: input.rideRequestId,
        provider: "mercadopago",
        mercadoPagoPaymentId,
        idempotencyKey,
        cancelledByRole: input.cancelledByRole,
        reason: input.reason ?? "",
      } as Record<string, string>,
    });

    return {
      ok: true,
      processed: true,
      refunded: true,
      paymentId: payment.id,
      mercadoPagoPaymentId,
      refund: refundResult.data,
    };
  }

  async handleWebhook(
    providerName: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<Result<{ processed: boolean }>> {
    let provider;

    try {
      provider = getProvider(providerName);
    } catch {
      return {
        ok: false,
        code: "WEBHOOK_UNKNOWN_PROVIDER",
        message: `Unknown payment provider: "${providerName}".`,
        statusCode: 400,
      };
    }

    if (!provider.verifyWebhookSignature(payload, headers)) {
      auditService.recordSafe({
        eventType: "payment.webhook_invalid_signature",
        entityType: "payment",
        metadata: { provider: providerName } as Record<string, string>,
      });
      return {
        ok: false,
        code: "WEBHOOK_INVALID_SIGNATURE",
        message: "Invalid webhook signature.",
        statusCode: 401,
      };
    }

    const eventIdentity = getWebhookEventIdentity(providerName, payload, headers);
    const claimed = await paymentsRepo.claimWebhookEvent({
      provider: providerName,
      eventKey: eventIdentity.eventKey,
      payloadHash: eventIdentity.payloadHash,
      payload,
      requestId: eventIdentity.requestId,
      action: eventIdentity.action,
      status: "processing",
      updatedAt: new Date(),
    });

    if (!claimed.claimed) {
      return { ok: true, processed: false };
    }

    const eventId = claimed.event.id;

    try {
      const normalized: NormalizedWebhook = await provider.normalizeWebhook(payload, headers);
      const { orderId, status, externalId, rawPayload } = normalized;

      if (!orderId) {
        await paymentsRepo.completeWebhookEvent({
          id: eventId,
          providerPaymentId: externalId || null,
          action: status,
        });
        return { ok: true, processed: false };
      }

      const payment = await paymentsRepo.findById(orderId);
      if (!payment) {
        await paymentsRepo.failWebhookEvent(eventId, `Payment not found: ${orderId}`);
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Payment not found.",
          statusCode: 404,
        };
      }

      const finish = async (processed: boolean): Promise<Result<{ processed: boolean }>> => {
        await paymentsRepo.completeWebhookEvent({
          id: eventId,
          paymentId: payment.id,
          providerPaymentId: externalId || payment.providerPaymentId || null,
          action: status,
        });
        return { ok: true, processed };
      };

      const paymentPurpose = getPaymentPurpose(payment.paymentPurpose);

      if (payment.status === "success") {
        try {
          if (paymentPurpose === "fast_search") {
            await activateFastSearchAfterPayment(payment.rideRequestId, "card");
          } else {
            await activateRideAfterApprovedPayment(payment.rideRequestId);
          }
        } catch {
          // El estado aprobado permanece persistido y puede conciliarse.
        }
        return finish(false);
      }

      if (["rejected", "failed", "refunded"].includes(payment.status)) {
        return finish(false);
      }

      if (status === "pending" || status === "unknown") {
        return finish(false);
      }

      if (status === "success") {
        if (providerName === "mercadopago") {
          const paidAmountClp = getMercadoPagoWebhookAmountClp(rawPayload);
          const currency = getMercadoPagoWebhookCurrency(rawPayload);
          const expectedAmountClp = Math.round(Number(payment.amountClp));
          const amountMatches = paidAmountClp != null && paidAmountClp === expectedAmountClp;
          const currencyMatches = !currency || currency === "CLP";

          if (!amountMatches || !currencyMatches) {
            await paymentsRepo.markRejected(payment.id, {
              ...rawPayload,
              rapagoValidation: {
                status: "amount_or_currency_mismatch",
                expectedAmountClp,
                paidAmountClp,
                expectedCurrency: "CLP",
                paidCurrency: currency || null,
              },
            });
            if (paymentPurpose === "ride") {
              try {
                await cancelRideAfterRejectedPayment(
                  payment.rideRequestId,
                  "Pago rechazado: el monto o la moneda no coincide con el viaje.",
                );
              } catch {
                // El viaje sigue oculto en pending_payment.
              }
            }
            auditService.recordSafe({
              actorUserId: payment.passengerUserId,
              eventType: "payment.amount_mismatch",
              entityType: "payment",
              entityId: payment.id,
              metadata: {
                rideId: payment.rideRequestId,
                expectedAmountClp,
                paidAmountClp: paidAmountClp ?? "missing",
                currency: currency || "missing",
                provider: providerName,
              },
            });
            return finish(true);
          }
        }

        if (paymentPurpose === "fast_search") {
          await paymentsRepo.markSuccess(
            payment.id,
            externalId,
            rawPayload,
          );
          await activateFastSearchAfterPayment(payment.rideRequestId, "card");
        } else {
          await paymentsRepo.markSuccessAndActivateRide({
            id: payment.id,
            rideRequestId: payment.rideRequestId,
            externalId,
            providerPayload: rawPayload,
          });
        }
        auditService.recordSafe({
          actorUserId: payment.passengerUserId,
          eventType: "payment.success",
          entityType: "payment",
          entityId: payment.id,
          metadata: {
            rideId: payment.rideRequestId,
            amountClp: payment.amountClp,
            externalId,
            provider: providerName,
            paymentPurpose,
          },
        });
        return finish(true);
      }

      if (status === "rejected") {
        await paymentsRepo.markRejected(payment.id, rawPayload);
        if (paymentPurpose === "ride") {
          try {
            await cancelRideAfterRejectedPayment(
              payment.rideRequestId,
              "Pago rechazado o cancelado por Mercado Pago.",
            );
          } catch {
            // El viaje permanece pending_payment y no se publica.
          }
        }
        auditService.recordSafe({
          actorUserId: payment.passengerUserId,
          eventType: "payment.rejected",
          entityType: "payment",
          entityId: payment.id,
          metadata: { rideId: payment.rideRequestId, provider: providerName },
        });
        return finish(true);
      }

      return finish(false);
    } catch (error) {
      await paymentsRepo.failWebhookEvent(eventId, String(error));
      auditService.recordSafe({
        eventType: "payment.webhook_processing_error",
        entityType: "payment",
        metadata: { provider: providerName, error: String(error) } as Record<string, string>,
      });
      return {
        ok: false,
        code: "WEBHOOK_PROVIDER_ERROR",
        message: "Could not process payment webhook.",
        statusCode: 502,
      };
    }
  }

}