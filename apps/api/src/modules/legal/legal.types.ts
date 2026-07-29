export interface LegalDocumentResponse {
  id: string; type: string; version: string; title: string;
  effectiveDate: string; isActive: boolean; createdAt: string; updatedAt: string;
  content?: string;
}

export interface UserAcceptanceResponse {
  id: string;
  userId: string;
  legalDocumentId: string;
  versionAccepted: string;
  acceptedAt: string;
  documentTitle?: string;
  documentType?: string;
  documentHash?: string;
  authenticationMethod?: string;
  acceptanceStatus?: string;
}

export type LegalDocumentsResult =
  | { ok: true; items: LegalDocumentResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type LegalDocumentResult =
  | { ok: true; document: LegalDocumentResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type UserAcceptanceResult =
  | { ok: true; acceptance: UserAcceptanceResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type UserAcceptancesResult =
  | { ok: true; items: UserAcceptanceResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type LegalAcceptanceStatus =
  | { ok: true; accepted: true }
  | { ok: true; accepted: false; missing: string[] }
  | { ok: false; code: string; message: string; statusCode: number };
