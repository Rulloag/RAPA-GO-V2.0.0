import { apiClient } from "../../services/api/index.js";

export interface BankAccountData {
  id:                 string;
  userId:             string;
  accountHolderName:  string;
  bankName:           string;
  accountType:        string;
  accountNumberLast4: string;
  status:             string;
  createdAt:          string;
  updatedAt:          string;
}

type BankAccountEnvelope = { ok: true; data: BankAccountData | null; statusCode: number };
type UpsertEnvelope      = { ok: true; data: BankAccountData;        statusCode: number };

export interface UpsertBankAccountInput {
  accountHolderName: string;
  bankName:          string;
  accountType:       string;
  accountNumber:     string;
}

export const bankAccountService = {
  async getBankAccount(accessToken: string): Promise<BankAccountData | null> {
    const result = await apiClient.get<BankAccountEnvelope>("/bank-account/me", { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to load bank account.");
    return (result.data as BankAccountEnvelope).data;
  },

  async upsertBankAccount(accessToken: string, input: UpsertBankAccountInput): Promise<BankAccountData> {
    const result = await apiClient.put<UpsertEnvelope>("/bank-account/me", input, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to save bank account.");
    return (result.data as UpsertEnvelope).data;
  },
};
