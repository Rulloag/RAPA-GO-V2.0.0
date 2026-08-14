import { apiClient } from "../../services/api/index.js";

export interface WalletData {
  id: string;
  userId?: string;
  balance: number;
  availableBenefitClp?: number;
  currency: string;
  status: string;
  benefitType?: "cash_overpayment_only";
  transferable?: boolean;
  rechargeable?: boolean;
}

export interface TransactionData {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
}

export interface CashOverpaymentBenefitData {
  id: string;
  sourceRideId: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  status: "pending_admin_review" | "approved" | "rejected" | string;
  paymentMethod: "cash";
  fareClp: number;
  paidClp: number;
  requestedAmountClp: number;
  approvedAmountClp: number | null;
  requestReason: string | null;
  adminDecisionReason: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  walletTransactionId: string | null;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOrderData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentUrl: string | null;
  providerOrderId: string | null;
  createdAt: string;
}


export interface PaymentStatusData {
  id: string;
  rideRequestId: string;
  status: string;
  paymentPurpose: "ride" | "fast_search";
  amountClp: number;
  provider: string;
  paidAt: string | null;
  rejectedAt: string | null;
  failedAt: string | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  declineCode: string | null;
  declineReason: string | null;
  retryAllowed: boolean;
  cardBrand: string | null;
  cardType: "credit" | "debit" | "prepaid" | null;
  cardLast4: string | null;
  installments: number | null;
  refundStatus: string | null;
  refundProviderId: string | null;
  refundedAt: string | null;
  receiptNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReceiptData {
  receiptNumber: string;
  paymentId: string;
  rideRequestId: string;
  paymentPurpose: "ride" | "fast_search";
  amountClp: number;
  currency: "CLP";
  provider: string;
  status: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  declineCode: string | null;
  declineReason: string | null;
  retryAllowed: boolean;
  cardBrand: string | null;
  cardType: "credit" | "debit" | "prepaid" | null;
  cardLast4: string | null;
  installments: number | null;
  refundStatus: string | null;
  refundProviderId: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  issuedAt: string;
}

export interface RequestCashOverpaymentBenefitPayload {
  rideId: string;
  paidClp: number;
  reason?: string;
}

export interface AdminCreateWalletCreditPayload {
  userId: string;
  rideId: string;
  amountClp: number;
  description?: string;
  reason?: string;
  externalReference?: string;
}

export interface AdminManualBenefitResponse {
  wallet: WalletData;
  transaction: TransactionData;
  manualGrant: true;
  owner: { id: string; name: string | null; email: string | null };
}

export interface AdminBenefitReviewPayload {
  approvedAmountClp?: number;
  adminDecisionReason?: string;
}

export interface AdminBenefitApprovalResponse {
  benefit: CashOverpaymentBenefitData;
  wallet: WalletData;
  transaction: TransactionData;
  alreadyApproved?: boolean;
}

type Envelope<T> = { ok: true; data: T; statusCode: number };

function unwrap<T>(
  result: {
    ok: boolean;
    data?: unknown;
    message?: string;
  },
  fallbackMessage: string,
): T {
  if (!result.ok) {
    throw new Error(result.message ?? fallbackMessage);
  }

  const envelope = result.data as Envelope<T> | undefined;
  if (!envelope || envelope.ok !== true) {
    throw new Error(fallbackMessage);
  }

  return envelope.data;
}

// Cache en memoria de getMyWallet(), solo lectura: WalletPage y
// RequestRidePage piden el mismo wallet por separado en cada montaje (sin
// esto, navegar Solicitar Viaje <-> Beneficios repite la consulta cada vez).
// TTL corto (no financiero: nunca se usa para decidir un cobro) + invalida
// ante los eventos que ya emite el resto de la app cuando el wallet cambia
// de verdad. Nada de esto toca localStorage: se limpia solo al recargar.
const WALLET_CACHE_TTL_MS = 45_000;

let walletCacheToken: string | null = null;
let walletCacheEntry: { data: WalletData; expiresAt: number } | null = null;
let walletCacheInFlight: Promise<WalletData> | null = null;

function invalidateWalletCache(): void {
  walletCacheEntry = null;
  walletCacheInFlight = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("rapago:wallet-updated", invalidateWalletCache);
  window.addEventListener(
    "rapago:wallet-benefit-updated",
    invalidateWalletCache,
  );
}

export const walletService = {
  async getMyWallet(accessToken: string): Promise<WalletData> {
    if (accessToken !== walletCacheToken) {
      // Cuenta distinta a la del cache: nunca reutilizar saldo de otro usuario.
      invalidateWalletCache();
      walletCacheToken = accessToken;
    }

    const now = Date.now();
    if (walletCacheEntry && walletCacheEntry.expiresAt > now) {
      return walletCacheEntry.data;
    }

    if (walletCacheInFlight) {
      return walletCacheInFlight;
    }

    const request = (async (): Promise<WalletData> => {
      const result = await apiClient.get<Envelope<WalletData>>(
        "/wallets/me",
        { token: accessToken },
      );
      const data = unwrap<WalletData>(result, "No se pudo cargar Beneficios.");

      walletCacheEntry = { data, expiresAt: Date.now() + WALLET_CACHE_TTL_MS };
      return data;
    })();

    walletCacheInFlight = request;

    try {
      return await request;
    } catch (error) {
      // No cachear errores: el próximo intento debe golpear la red de nuevo.
      invalidateWalletCache();
      throw error;
    } finally {
      if (walletCacheInFlight === request) {
        walletCacheInFlight = null;
      }
    }
  },

  async getMyTransactions(
    accessToken: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: TransactionData[]; total: number }> {
    const result = await apiClient.get<
      Envelope<{ items: TransactionData[]; total: number }>
    >(
      `/wallets/me/transactions?page=${page}&limit=${limit}`,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo cargar el registro de Beneficios.");
  },

  async listMyCashOverpaymentBenefits(
    accessToken: string,
  ): Promise<CashOverpaymentBenefitData[]> {
    const result = await apiClient.get<
      Envelope<CashOverpaymentBenefitData[]>
    >(
      "/wallets/me/cash-overpayment-benefits",
      { token: accessToken },
    );
    return unwrap(result, "No se pudieron cargar tus solicitudes.");
  },

  async requestCashOverpaymentBenefit(
    accessToken: string,
    payload: RequestCashOverpaymentBenefitPayload,
  ): Promise<CashOverpaymentBenefitData> {
    const result = await apiClient.post<
      Envelope<CashOverpaymentBenefitData>
    >(
      "/wallets/me/cash-overpayment-benefits",
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo solicitar el Beneficio.");
  },

  async adminListCashOverpaymentBenefits(
    accessToken: string,
    status: string = "all",
  ): Promise<CashOverpaymentBenefitData[]> {
    const result = await apiClient.get<
      Envelope<CashOverpaymentBenefitData[]>
    >(
      `/admin/wallet/cash-overpayment-benefits?status=${encodeURIComponent(status)}`,
      { token: accessToken },
    );
    return unwrap(result, "No se pudieron cargar las solicitudes.");
  },

  async adminApproveCashOverpaymentBenefit(
    accessToken: string,
    benefitId: string,
    payload: AdminBenefitReviewPayload = {},
  ): Promise<AdminBenefitApprovalResponse> {
    const result = await apiClient.post<
      Envelope<AdminBenefitApprovalResponse>
    >(
      `/admin/wallet/cash-overpayment-benefits/${encodeURIComponent(benefitId)}/approve`,
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo aprobar el Beneficio.");
  },

  async adminApproveCashOverpaymentBenefitByRide(
    accessToken: string,
    rideId: string,
    payload: AdminBenefitReviewPayload = {},
  ): Promise<AdminBenefitApprovalResponse> {
    const result = await apiClient.post<
      Envelope<AdminBenefitApprovalResponse>
    >(
      `/admin/wallet/cash-overpayment-benefits/by-ride/${encodeURIComponent(rideId)}/approve`,
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo aprobar el Beneficio.");
  },

  async adminRejectCashOverpaymentBenefit(
    accessToken: string,
    benefitId: string,
    adminDecisionReason: string,
  ): Promise<CashOverpaymentBenefitData> {
    const result = await apiClient.post<
      Envelope<CashOverpaymentBenefitData>
    >(
      `/admin/wallet/cash-overpayment-benefits/${encodeURIComponent(benefitId)}/reject`,
      { adminDecisionReason },
      { token: accessToken },
    );
    return unwrap(result, "No se pudo rechazar el Beneficio.");
  },

  async adminRejectCashOverpaymentBenefitByRide(
    accessToken: string,
    rideId: string,
    adminDecisionReason: string,
  ): Promise<CashOverpaymentBenefitData> {
    const result = await apiClient.post<
      Envelope<CashOverpaymentBenefitData>
    >(
      `/admin/wallet/cash-overpayment-benefits/by-ride/${encodeURIComponent(rideId)}/reject`,
      { adminDecisionReason },
      { token: accessToken },
    );
    return unwrap(result, "No se pudo rechazar el Beneficio.");
  },

  /** Compatibilidad con el botón antiguo del panel Admin. */
  async adminCreateWalletCredit(
    accessToken: string,
    payload: AdminCreateWalletCreditPayload,
  ): Promise<AdminBenefitApprovalResponse> {
    const result = await apiClient.post<
      Envelope<AdminBenefitApprovalResponse>
    >(
      "/admin/wallet/credits",
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo aprobar el Beneficio.");
  },

  async adminGrantManualBenefit(
    accessToken: string,
    payload: {
      userId: string;
      amountClp: number;
      reason: string;
      externalReference: string;
    },
  ): Promise<AdminManualBenefitResponse> {
    const result = await apiClient.post<Envelope<AdminManualBenefitResponse>>(
      "/admin/wallet/manual-benefits",
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo otorgar el Beneficio manual.");
  },

  async getPaymentStatus(
    accessToken: string,
    paymentId: string,
  ): Promise<PaymentStatusData> {
    const result = await apiClient.get<Envelope<PaymentStatusData>>(
      `/payments/${encodeURIComponent(paymentId)}/status`,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo consultar el estado del pago.");
  },

  async reconcileKlapPayment(
    accessToken: string,
    paymentId: string,
  ): Promise<{ status: string; providerStatus: string }> {
    const result = await apiClient.post<
      Envelope<{ status: string; providerStatus: string }>
    >(
      `/payments/${encodeURIComponent(paymentId)}/reconcile/klap`,
      {},
      { token: accessToken },
    );

    return unwrap(
      result,
      "No se pudo consultar la orden directamente en Klap.",
    );
  },

  async getPaymentReceipt(
    accessToken: string,
    paymentId: string,
  ): Promise<PaymentReceiptData> {
    const result = await apiClient.get<Envelope<PaymentReceiptData>>(
      `/payments/${encodeURIComponent(paymentId)}/receipt`,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo cargar el comprobante de pago.");
  },

  async createPaymentOrder(
    accessToken: string,
    rideId: string,
    amount?: number,
  ): Promise<PaymentOrderData> {
    const body: { rideId: string; amount?: number } = { rideId };
    if (amount != null) body.amount = amount;

    const result = await apiClient.post<Envelope<PaymentOrderData>>(
      "/payments/create-order",
      body,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo crear la orden de pago.");
  },
};
