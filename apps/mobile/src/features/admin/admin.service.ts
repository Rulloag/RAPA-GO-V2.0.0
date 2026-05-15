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

export interface ListUsersParams {
  role?:   string;
  status?: string;
  search?: string;
}

export const adminService = {
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
};
