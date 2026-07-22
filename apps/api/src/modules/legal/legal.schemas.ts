import { z } from "zod";

export const LEGAL_DOCUMENT_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "intellectual_property",
  "software_license",
  "data_providers",
  "user_conditions",
  "driver_conditions",
  "guide_conditions",
  "event_conditions",
] as const;

const definitiveContentSchema = z.string().trim().min(80).max(80_000).refine(
  (value) => !/documento\s+(est[aá]\s+)?en\s+preparaci[oó]n/i.test(value),
  "No se puede publicar un documento legal en preparación.",
);

export const createLegalDocumentSchema = z.object({
  type: z.enum(LEGAL_DOCUMENT_TYPES),
  version: z.string().trim().regex(/^\d+\.\d+(?:\.\d+)?$/).max(20),
  title: z.string().trim().min(5).max(180),
  content: definitiveContentSchema,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateLegalDocumentSchema = z.object({
  title: z.string().trim().min(5).max(180).optional(),
  content: definitiveContentSchema.optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");

export const createLegalAcceptanceSchema = z.object({
  legalDocumentId: z.string().uuid(),
  version: z.string().trim().min(1).max(20),
});
