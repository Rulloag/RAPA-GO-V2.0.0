import type { AuditEvent } from "../../db/schema/index.js";

export type { AuditEvent };

/** JSON-serializable value accepted as audit metadata. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Input for creating an audit event record. */
export interface CreateAuditEventInput {
  actorUserId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: JsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/** Convenience shape for auth-related audit helpers. */
export interface AuthAuditInput {
  actorUserId?: string | null;
  eventType:
    | "auth.login.success"
    | "auth.login.failure"
    | "auth.register.success"
    | "auth.register.failure"
    | "auth.logout"
    | "auth.token.refresh"
    | "auth.token.revoked";
  metadata?: JsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/** Convenience shape for user-related audit helpers. */
export interface UserAuditInput {
  actorUserId?: string | null;
  eventType:
    | "user.created"
    | "user.verified"
    | "user.status.changed"
    | "user.profile.updated";
  entityId?: string;
  metadata?: JsonValue;
  ipAddress?: string;
  userAgent?: string;
}
