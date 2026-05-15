export interface AdminUserResponse {
  id:         string;
  email:      string;
  name:       string;
  role:       string;
  status:     string;
  isVerified: boolean;
  createdAt:  string;
}

export interface AdminDocumentResponse {
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

type ErrorResult = { ok: false; code: string; message: string; statusCode: number };

export type AdminUsersListResult     = { ok: true; users:     AdminUserResponse[]     } | ErrorResult;
export type AdminUserResult          = { ok: true; user:      AdminUserResponse        } | ErrorResult;
export type AdminDocumentsListResult = { ok: true; documents: AdminDocumentResponse[] } | ErrorResult;
export type AdminDocumentResult      = { ok: true; document:  AdminDocumentResponse   } | ErrorResult;
