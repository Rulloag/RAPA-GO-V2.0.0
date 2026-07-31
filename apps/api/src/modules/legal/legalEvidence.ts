import { createHash } from "node:crypto";

import type { LegalDocument } from "../../db/schema/index.js";

export type LegalAuthenticationMethod =
  | "password"
  | "facebook"
  | "apple"
  | "google"
  | "session_reacceptance"
  | "driver_application";

export function createLegalDocumentHash(
  document: Pick<
    LegalDocument,
    | "type"
    | "version"
    | "title"
    | "content"
    | "effectiveDate"
  >,
): string {
  return createHash("sha256")
    .update(
      [
        document.type,
        document.version,
        document.title,
        document.effectiveDate,
        document.content,
      ].join("\n"),
      "utf8",
    )
    .digest("hex");
}

export function buildLegalAcceptanceEvidence(
  document: Pick<
    LegalDocument,
    | "type"
    | "version"
    | "title"
    | "content"
    | "effectiveDate"
  >,
  authenticationMethod: LegalAuthenticationMethod,
): {
  documentType: string;
  documentTitle: string;
  documentHash: string;
  authenticationMethod: LegalAuthenticationMethod;
  acceptanceStatus: "accepted";
} {
  return {
    documentType: document.type,
    documentTitle: document.title,
    documentHash: createLegalDocumentHash(document),
    authenticationMethod,
    acceptanceStatus: "accepted",
  };
}
