import { apiClient } from "../../services/api/index.js";

export interface ReferralSummary {
  code:          string;
  link:          string;
  usedCount:     number;
  totalReward:   number;
  pendingReward: number;
}

export interface ReferralCodeData {
  id:             string;
  userId:         string | null;
  code:           string;
  type:           string;
  discountAmount: number | null;
  discountType:   string;
  maxUses:        number | null;
  usedCount:      number;
  expiresAt:      string | null;
  isActive:       boolean;
  createdAt:      string;
  link:           string;
  ownerName?:     string | null;
  ownerEmail?:    string | null;
  conversionCount?: number;
  totalReward?:   number;
}

export interface ReferralUseData {
  id:                string;
  referralCodeId:    string;
  referredUserId:    string | null;
  referredAt:        string;
  convertedAt:       string | null;
  conversionValue:   number | null;
  rewardApplied:     boolean;
  rewardAmount:      number | null;
  createdAt:         string;
  referredUserName?:  string | null;
  referredUserEmail?: string | null;
}

export const referralsService = {
  async getMyReferral(token: string): Promise<ReferralSummary> {
    const result = await apiClient.get<{ data: ReferralSummary }>("/referrals/me", { token });
    if (result.ok === false) throw new Error(result.message ?? "Failed to load referral data.");
    return result.data.data;
  },

  async generateCode(token: string, code?: string): Promise<{ code: string; link: string }> {
    const body: { code?: string } = {};
    if (code) body.code = code;
    const result = await apiClient.post<{ data: { code: string; link: string } }>("/referrals/generate", body, { token });
    if (result.ok === false) throw new Error(result.message ?? "Failed to generate referral code.");
    return result.data.data;
  },

  async applyCode(code: string, userId?: string): Promise<{ success: boolean; message: string }> {
    const body: { code: string; userId?: string } = { code };
    if (userId) body.userId = userId;
    const result = await apiClient.post<{ data: { success: boolean; message: string } }>("/referrals/apply", body);
    if (result.ok === false) throw new Error(result.message ?? "Failed to apply referral code.");
    return result.data.data;
  },

  async adminListCodes(token: string, page = 1, limit = 20): Promise<{ items: ReferralCodeData[]; total: number }> {
    const result = await apiClient.get<{ data: { items: ReferralCodeData[]; total: number } }>(
      `/admin/referrals?page=${page}&limit=${limit}`, { token }
    );
    if (result.ok === false) throw new Error(result.message ?? "Failed to load referral codes.");
    return result.data.data;
  },

  async adminListUses(token: string, codeId: string): Promise<ReferralUseData[]> {
    const result = await apiClient.get<{ data: { items: ReferralUseData[] } }>(
      `/admin/referrals/${codeId}/uses`, { token }
    );
    if (result.ok === false) throw new Error(result.message ?? "Failed to load referral uses.");
    return result.data.data.items;
  },

  async adminCreateCampaignCode(token: string, data: {
    code: string;
    type: "promo" | "partner";
    discountAmount: number;
    discountType: "percentage" | "fixed_amount";
    maxUses: number | null;
    expiresAt: string | null;
  }): Promise<{ code: string; link: string }> {
    const result = await apiClient.post<{ data: { code: string; link: string } }>(
      "/admin/referrals/campaigns", data, { token }
    );
    if (result.ok === false) throw new Error(result.message ?? "Failed to create campaign code.");
    return result.data.data;
  },
};
