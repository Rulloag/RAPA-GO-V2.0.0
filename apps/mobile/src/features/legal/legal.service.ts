import { apiClient } from "../../services/api/index.js";

export interface LegalDocumentData {
  id: string; type: string; version: string; title: string;
  effectiveDate: string; isActive: boolean; createdAt: string; updatedAt: string;
  content?: string;
}

export interface UserAcceptanceData {
  id: string;
  legalDocumentId: string;
  versionAccepted: string;
  acceptedAt: string;
  documentTitle?: string;
  documentType?: string;
  documentHash?: string;
  authenticationMethod?: string;
  acceptanceStatus?: string;
}

export const legalService = {
  async getActive(): Promise<LegalDocumentData[]> {
    const result = await apiClient.get<any>("/legal-documents/active", {});
    if (!result.ok) throw new Error("Error al cargar documentos legales");
    return result.data.data.items;
  },
  async getDocument(id: string): Promise<LegalDocumentData> {
    const result = await apiClient.get<any>(`/legal-documents/${id}`, {});
    if (!result.ok) throw new Error("Error al cargar documento");
    return result.data.data.document;
  },
  async accept(token: string, legalDocumentId: string, version: string): Promise<UserAcceptanceData> {
    const result = await apiClient.post<any>("/user-acceptances", { legalDocumentId, version }, { token });
    if (!result.ok) throw new Error("Error al registrar aceptación");
    return result.data.data.acceptance;
  },
  async getMyAcceptances(token: string): Promise<UserAcceptanceData[]> {
    const result = await apiClient.get<any>("/user-acceptances/me", { token });
    if (!result.ok) throw new Error("Error al cargar aceptaciones");
    return result.data.data.items;
  },
  async getMissingRequired(
    token: string,
    requiredTypes: string[],
  ): Promise<LegalDocumentData[]> {
    const [documents, acceptances] = await Promise.all([
      this.getActive(),
      this.getMyAcceptances(token),
    ]);

    const acceptedDocumentIds = new Set(
      acceptances.map(
        (acceptance) =>
          `${acceptance.legalDocumentId}:${acceptance.versionAccepted}`,
      ),
    );

    return documents.filter(
      (document) =>
        requiredTypes.includes(document.type) &&
        !acceptedDocumentIds.has(`${document.id}:${document.version}`),
    );
  },
};
