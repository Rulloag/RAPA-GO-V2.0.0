import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name:      z.string().min(2, "Name must be at least 2 characters.").max(100).optional(),
    avatarUrl: z.string().url("avatarUrl must be a valid URL.").nullable().optional(),
  })
  .refine(
    (data) => data.name !== undefined || "avatarUrl" in data,
    { message: "At least one field (name or avatarUrl) must be provided." },
  );

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
