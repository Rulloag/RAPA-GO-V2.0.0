import { z } from "zod";

const VALID_ROLES   = ["passenger", "driver", "guide", "rental", "admin"] as const;
const VALID_STATUSES = ["pending", "active", "suspended", "banned"] as const;

export const listUsersQuerySchema = z.object({
  role:   z.enum(VALID_ROLES).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
