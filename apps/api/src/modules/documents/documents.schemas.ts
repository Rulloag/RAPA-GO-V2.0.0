import { z } from "zod";

export const createDocumentSchema = z.object({
  documentType: z.string().min(1, "documentType is required."),
});

export type CreateDocumentBody = z.infer<typeof createDocumentSchema>;
