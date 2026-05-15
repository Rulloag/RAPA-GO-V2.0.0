import { apiClient } from "../../services/api/index.js";

export interface AdminUserData {
  id:         string;
  email:      string;
  name:       string;
  role:       string;
  status:     string;
  isVerified: boolean;
  createdAt:  string;
}

export interface AdminDocumentData {
  id:              string;
  userId:          string;
  userName:        string;
  userEmail:       string;
  userRole:        string;
  documentType:    string;
  status:          string;
  fileUrl:         string | null;
  rejectionReason: string | null;
  uploadedAt:      string | null;
  reviewedAt:      string | null;
  createdAt:       string;
}

export interface ListUsersParams {
  role?:   string;
  status?: string;
  search?: string;
}

export interface ListDocumentsParams {
  status?:       string;
  documentType?: string;
  userId?:       string;
}

export const adminService = {
  async updateUserStatus(accessToken: string, userId: string, status: string): Promise<AdminUserData> {
    type Envelope = { ok: true; data: AdminUserData; statusCode: number };
    const result = await apiClient.patch<Envelope>(
      `/admin/users/${userId}/status`,
      { status },
      { token: accessToken },
    );
    if (!result.ok) throw new Error(result.message ?? "Failed to update user status.");
    return (result.data as Envelope).data;
  },

  async listUsers(accessToken: string, params: ListUsersParams = {}): Promise<AdminUserData[]> {
    type Envelope = { ok: true; data: AdminUserData[]; statusCode: number };
    const parts: string[] = [];
    if (params.role)   parts.push(`role=${encodeURIComponent(params.role)}`);
    if (params.status) parts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.search) parts.push(`search=${encodeURIComponent(params.search)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    const result = await apiClient.get<Envelope>(`/admin/users${qs}`, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load users.");
    return (result.data as Envelope).data;
  },

  async listDocuments(accessToken: string, params: ListDocumentsParams = {}): Promise<AdminDocumentData[]> {
    type Envelope = { ok: true; data: AdminDocumentData[]; statusCode: number };
    const parts: string[] = [];
    if (params.status)       parts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.documentType) parts.push(`documentType=${encodeURIComponent(params.documentType)}`);
    if (params.userId)       parts.push(`userId=${encodeURIComponent(params.userId)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    const result = await apiClient.get<Envelope>(`/admin/documents${qs}`, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load documents.");
    return (result.data as Envelope).data;
  },

  async reviewDocument(
    accessToken: string,
    documentId: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ): Promise<AdminDocumentData> {
    type Envelope = { ok: true; data: AdminDocumentData; statusCode: number };
    const body: { status: string; rejectionReason?: string } = { status };
    if (rejectionReason) body.rejectionReason = rejectionReason;
    const result = await apiClient.patch<Envelope>(
      `/admin/documents/${documentId}/review`,
      body,
      { token: accessToken },
    );
    if (!result.ok) throw new Error(result.message ?? "Failed to review document.");
    return (result.data as Envelope).data;
  },
};
