import type { UserRole } from "@rapa-go/shared";
import type { User } from "../../db/schema/index.js";

export type { User };

/** Allowed values for the user status column. */
export type UserStatus = "pending" | "active" | "suspended" | "banned" | "deleted";

/** Input for creating a new user record. Passwords are never stored in users. */
export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  status?: UserStatus;
  avatarUrl?: string;
}

/** Input for updating user status. */
export interface UpdateUserStatusInput {
  userId: string;
  status: UserStatus;
}

/** Fields a user can update on their own profile. */
export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
  phone?: string;
}
