import { apiClient } from "../../services/api/index.js";
import type { ApiResponse } from "../../services/api/apiTypes.js";

export type SupportCategory =
  | "support"
  | "complaint"
  | "lost_item"
  | "safety"
  | "payment"
  | "other";
export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SupportStatus =
  | "open"
  | "in_review"
  | "waiting_user"
  | "resolved"
  | "closed"
  | "rejected";

export interface SupportCaseData {
  id: string;
  trackingCode: string;
  requesterUserId: string;
  requesterRole: string;
  requesterName: string | null;
  requesterEmail: string | null;
  rideRequestId: string | null;
  category: SupportCategory;
  subject: string;
  description: string;
  priority: SupportPriority;
  status: SupportStatus;
  contactPhone: string | null;
  contactEmail: string | null;
  lostItemDescription: string | null;
  lostItemLastSeenAt: string | null;
  assignedAdminUserId: string | null;
  assignedAdminName: string | null;
  adminResolution: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportCaseEventData {
  id: string;
  supportCaseId: string;
  actorUserId: string | null;
  actorRole: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  publicMessage: string | null;
  internalNote: string | null;
  createdAt: string;
}

export interface SupportCaseDetailData {
  supportCase: SupportCaseData;
  events: SupportCaseEventData[];
}

export interface CreateSupportCasePayload {
  category: SupportCategory;
  subject: string;
  description: string;
  priority: SupportPriority;
  rideRequestId?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  lostItemDescription?: string | null;
  lostItemLastSeenAt?: string | null;
}

export interface AdminSupportUpdatePayload {
  status?: SupportStatus;
  priority?: SupportPriority;
  publicMessage?: string;
  internalNote?: string;
  resolution?: string;
  assignToMe?: boolean;
}

function unwrap<T>(result: ApiResponse<T>): T {
  if (result.ok === false) throw new Error(result.message);
  return result.data;
}

export const supportService = {
  async create(accessToken: string, payload: CreateSupportCasePayload): Promise<SupportCaseData> {
    const result = await apiClient.post<{ ok: true; data: SupportCaseData; statusCode: number }>(
      "/support/cases",
      payload,
      { token: accessToken },
    );
    const envelope = unwrap(result);
    return envelope.data;
  },

  async listMine(accessToken: string): Promise<SupportCaseData[]> {
    const result = await apiClient.get<{ ok: true; data: { items: SupportCaseData[] }; statusCode: number }>(
      "/support/cases/me",
      { token: accessToken },
    );
    return unwrap(result).data.items;
  },

  async getMine(accessToken: string, caseId: string): Promise<SupportCaseDetailData> {
    const result = await apiClient.get<{ ok: true; data: SupportCaseDetailData; statusCode: number }>(
      `/support/cases/${caseId}`,
      { token: accessToken },
    );
    return unwrap(result).data;
  },

  async addMessage(accessToken: string, caseId: string, message: string): Promise<SupportCaseDetailData> {
    const result = await apiClient.post<{ ok: true; data: SupportCaseDetailData; statusCode: number }>(
      `/support/cases/${caseId}/messages`,
      { message },
      { token: accessToken },
    );
    return unwrap(result).data;
  },

  async listAdmin(
    accessToken: string,
    filters: { status?: string; category?: string; priority?: string; search?: string } = {},
  ): Promise<SupportCaseData[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const result = await apiClient.get<{ ok: true; data: { items: SupportCaseData[] }; statusCode: number }>(
      `/admin/support/cases${suffix}`,
      { token: accessToken },
    );
    return unwrap(result).data.items;
  },

  async getAdmin(accessToken: string, caseId: string): Promise<SupportCaseDetailData> {
    const result = await apiClient.get<{ ok: true; data: SupportCaseDetailData; statusCode: number }>(
      `/admin/support/cases/${caseId}`,
      { token: accessToken },
    );
    return unwrap(result).data;
  },

  async updateAdmin(
    accessToken: string,
    caseId: string,
    payload: AdminSupportUpdatePayload,
  ): Promise<SupportCaseDetailData> {
    const result = await apiClient.patch<{ ok: true; data: SupportCaseDetailData; statusCode: number }>(
      `/admin/support/cases/${caseId}`,
      payload,
      { token: accessToken },
    );
    return unwrap(result).data;
  },
};
