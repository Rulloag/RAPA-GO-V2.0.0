import { apiClient } from "../../services/api/index.js";

export interface WalletData {
  id:        string;
  balance:   number;
  currency:  string;
  status:    string;
}

export interface TransactionData {
  id:          string;
  type:        string;
  amount:      number;
  currency:    string;
  status:      string;
  description: string | null;
  createdAt:   string;
}

export interface PaymentOrderData {
  id:              string;
  amount:          number;
  currency:        string;
  status:          string;
  paymentUrl:      string | null;
  providerOrderId: string | null;
  createdAt:       string;
}


export interface AdminCreateWalletCreditPayload {
  userId: string;
  rideId?: string;
  amountClp: number;
  description?: string;
  reason?: string;
  externalReference?: string;
}

export interface AdminCreateWalletCreditResponse {
  wallet: WalletData;
  transaction: TransactionData;
}

type Envelope<T> = { ok: true; data: T; statusCode: number };

export const walletService = {
  async getMyWallet(accessToken: string): Promise<WalletData> {
    const result = await apiClient.get<Envelope<WalletData>>("/wallets/me", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading wallet.");
    return (result.data as Envelope<WalletData>).data;
  },

  async getMyTransactions(
    accessToken: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: TransactionData[]; total: number }> {
    const result = await apiClient.get<Envelope<{ items: TransactionData[]; total: number }>>(
      `/wallets/me/transactions?page=${page}&limit=${limit}`,
      { token: accessToken },
    );
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading transactions.");
    return (result.data as Envelope<{ items: TransactionData[]; total: number }>).data;
  },


  async adminCreateWalletCredit(
    accessToken: string,
    payload: AdminCreateWalletCreditPayload,
  ): Promise<AdminCreateWalletCreditResponse> {
    const result = await apiClient.post<Envelope<AdminCreateWalletCreditResponse>>(
      "/admin/wallet/credits",
      payload,
      { token: accessToken },
    );
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error approving wallet credit.");
    return (result.data as Envelope<AdminCreateWalletCreditResponse>).data;
  },

  async createPaymentOrder(
    accessToken: string,
    rideId: string,
    amount: number,
  ): Promise<PaymentOrderData> {
    const result = await apiClient.post<Envelope<PaymentOrderData>>(
      "/payments/create-order",
      { rideId, amount },
      { token: accessToken },
    );
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error creating payment order.");
    return (result.data as Envelope<PaymentOrderData>).data;
  },
};
