import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/client.js";
import { legalDocuments } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

export const REQUIRED_REGISTRATION_LEGAL_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
] as const;

export type RegistrationLegalAcceptanceInput = {
  legalDocumentId: string;
  version: string;
};

export async function validateRequiredRegistrationLegalAcceptances(
  submitted: readonly RegistrationLegalAcceptanceInput[],
): Promise<Array<typeof legalDocuments.$inferSelect>> {
  const activeDocuments = await db
    .select()
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.isActive, true),
        inArray(
          legalDocuments.type,
          [...REQUIRED_REGISTRATION_LEGAL_TYPES],
        ),
      ),
    );

  const activeByType = new Map(
    activeDocuments.map((document) => [document.type, document]),
  );
  const submittedById = new Map(
    submitted.map((item) => [item.legalDocumentId, item.version]),
  );

  for (const type of REQUIRED_REGISTRATION_LEGAL_TYPES) {
    const document = activeByType.get(type);

    if (!document) {
      throw new AppError({
        code: "LEGAL_DOCUMENT_UNAVAILABLE",
        message: `El documento legal obligatorio ${type} no está disponible.`,
        statusCode: 503,
      });
    }

    if (submittedById.get(document.id) !== document.version) {
      throw new AppError({
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message:
          "Debes aceptar Términos y Condiciones, Política de Privacidad y Condiciones para Usuarios antes de crear la cuenta.",
        statusCode: 409,
      });
    }
  }

  return REQUIRED_REGISTRATION_LEGAL_TYPES.map((type) => {
    const document = activeByType.get(type);
    if (!document) {
      throw AppError.internal("Missing active legal document.");
    }
    return document;
  });
}
