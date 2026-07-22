import { apiClient } from "../../services/api/index.js";

export type CashRefundStatus =
  | "pending_admin_review"
  | "approved_for_transfer"
  | "completed"
  | "rejected"
  | string;

export interface CashOverpaymentRefundData {
  id: string;
  sourceRideId: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  status: CashRefundStatus;
  paymentMethod: "cash";
  fareClp: number;
  paidClp: number;
  requestedAmountClp: number;
  approvedAmountClp: number | null;
  requestReason: string | null;
  adminDecisionReason: string | null;
  bankAccount: {
    holderName: string;
    bankName: string;
    accountType: string;
    accountNumberLast4: string;
  };
  transferReference: string | null;
  transferProofUrl: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashRefundTransferDetails {
  refundId: string;
  ownerUserId: string;
  amountClp: number;
  holderName: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountNumberLast4: string;
}

interface Envelope<T> {
  ok: true;
  data: T;
  statusCode: number;
}

function unwrap<T>(
  result: { ok: boolean; data?: unknown; message?: string },
  fallback: string,
): T {
  if (!result.ok) throw new Error(result.message ?? fallback);
  const envelope = result.data as Envelope<T> | undefined;
  if (!envelope || envelope.ok !== true) throw new Error(fallback);
  return envelope.data;
}

export const cashRefundsService = {
  async listMine(accessToken: string): Promise<CashOverpaymentRefundData[]> {
    const result = await apiClient.get<Envelope<CashOverpaymentRefundData[]>>(
      "/wallets/me/cash-overpayment-refunds",
      { token: accessToken },
    );
    return unwrap(result, "No se pudieron cargar tus devoluciones.");
  },

  async request(
    accessToken: string,
    payload: { rideId: string; paidClp: number; reason?: string },
  ): Promise<CashOverpaymentRefundData> {
    const result = await apiClient.post<Envelope<CashOverpaymentRefundData>>(
      "/wallets/me/cash-overpayment-refunds",
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo solicitar la devolución bancaria.");
  },

  async listForAdmin(
    accessToken: string,
    status = "all",
  ): Promise<CashOverpaymentRefundData[]> {
    const result = await apiClient.get<Envelope<CashOverpaymentRefundData[]>>(
      `/admin/wallet/cash-overpayment-refunds?status=${encodeURIComponent(status)}`,
      { token: accessToken },
    );
    return unwrap(result, "No se pudieron cargar las devoluciones.");
  },

  async getTransferDetails(
    accessToken: string,
    refundId: string,
  ): Promise<CashRefundTransferDetails> {
    const result = await apiClient.get<Envelope<CashRefundTransferDetails>>(
      `/admin/wallet/cash-overpayment-refunds/${encodeURIComponent(refundId)}/transfer-details`,
      { token: accessToken },
    );
    return unwrap(result, "No se pudieron abrir los datos de transferencia.");
  },

  async approve(
    accessToken: string,
    refundId: string,
    payload: { approvedAmountClp?: number; adminDecisionReason?: string } = {},
  ): Promise<CashOverpaymentRefundData> {
    const result = await apiClient.post<Envelope<CashOverpaymentRefundData>>(
      `/admin/wallet/cash-overpayment-refunds/${encodeURIComponent(refundId)}/approve`,
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo aprobar la devolución.");
  },

  async reject(
    accessToken: string,
    refundId: string,
    adminDecisionReason: string,
  ): Promise<CashOverpaymentRefundData> {
    const result = await apiClient.post<Envelope<CashOverpaymentRefundData>>(
      `/admin/wallet/cash-overpayment-refunds/${encodeURIComponent(refundId)}/reject`,
      { adminDecisionReason },
      { token: accessToken },
    );
    return unwrap(result, "No se pudo rechazar la devolución.");
  },

  async complete(
    accessToken: string,
    refundId: string,
    payload: {
      transferReference: string;
      transferProofUrl?: string;
      adminDecisionReason?: string;
    },
  ): Promise<CashOverpaymentRefundData> {
    const result = await apiClient.post<Envelope<CashOverpaymentRefundData>>(
      `/admin/wallet/cash-overpayment-refunds/${encodeURIComponent(refundId)}/complete`,
      payload,
      { token: accessToken },
    );
    return unwrap(result, "No se pudo marcar la transferencia como completada.");
  },
};
