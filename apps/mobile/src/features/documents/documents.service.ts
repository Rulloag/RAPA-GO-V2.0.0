import { apiClient } from "../../services/api/index.js";

export interface DocumentRecord {
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

type DocsEnvelope   = { ok: true; data: DocumentRecord[]; statusCode: number };
type DocEnvelope    = { ok: true; data: DocumentRecord;   statusCode: number };

export const documentsService = {
  async listDocuments(accessToken: string): Promise<DocumentRecord[]> {
    const result = await apiClient.get<DocsEnvelope>("/documents/me", { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load documents.");
    return (result.data as DocsEnvelope).data;
  },

  async createDocument(accessToken: string, documentType: string): Promise<DocumentRecord> {
    const result = await apiClient.post<DocEnvelope>("/documents/me", { documentType }, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to create document record.");
    return (result.data as DocEnvelope).data;
  },
};
