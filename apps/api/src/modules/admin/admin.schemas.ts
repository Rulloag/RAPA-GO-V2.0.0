import { z } from "zod";

export const listUsersQuerySchema = z.object({
  role:   z.string().trim().optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
