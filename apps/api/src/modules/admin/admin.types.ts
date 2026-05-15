export interface AdminUserResponse {
  id:         string;
  email:      string;
  name:       string;
  role:       string;
  status:     string;
  isVerified: boolean;
  createdAt:  string;
}

type ErrorResult = { ok: false; code: string; message: string; statusCode: number };

export type AdminUsersListResult = { ok: true; users: AdminUserResponse[] } | ErrorResult;
