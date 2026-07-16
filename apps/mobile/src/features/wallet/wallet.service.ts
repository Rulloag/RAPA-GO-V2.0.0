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
};
