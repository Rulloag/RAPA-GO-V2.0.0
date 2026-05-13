export interface DocumentResponse {
  id:              string;
  userId:          string;
  documentType:    string;
  documentLabel:   string;
  status:          string;
  fileUrl:         string | null;
  rejectionReason: string | null;
  uploadedAt:      string | null;
  reviewedAt:      string | null;
  createdAt:       string;
}

export type DocumentsServiceResult =
  | { ok: true;  documents: DocumentResponse[] }
  | { ok: false; code: string; message: string; statusCode?: number };

export type DocumentCreateResult =
  | { ok: true;  document: DocumentResponse }
  | { ok: false; code: string; message: string; statusCode?: number };
