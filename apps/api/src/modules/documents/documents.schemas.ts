import { z } from "zod";

export const createDocumentSchema = z.object({
  documentType: z.string().min(1, "documentType is required."),
});

export type CreateDocumentBody = z.infer<typeof createDocumentSchema>;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadMetadataSchema = z.object({
  fileName:      z.string().trim().min(3, "fileName must be at least 3 characters.").max(180, "fileName must be at most 180 characters."),
  fileMimeType:  z.enum(ALLOWED_MIME_TYPES, { errorMap: () => ({ message: "fileMimeType must be image/jpeg, image/png, or application/pdf." }) }),
  fileSizeBytes: z.number().int().gt(0, "fileSizeBytes must be greater than 0.").lte(MAX_FILE_BYTES, "fileSizeBytes must be at most 10 MB (10485760 bytes)."),
});

export type UploadMetadataBody = z.infer<typeof uploadMetadataSchema>;
