import { db } from "../../db/client.js";
import { auditEvents } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuditEvent, CreateAuditEventInput } from "./audit.types.js";

/**
 * AuditRepository — append-only access to the audit_events table.
 * No update or delete methods exist by design.
 */
export class AuditRepository {
  async createEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
    try {
      const rows = await db
        .insert(auditEvents)
        .values({
          actorUserId: input.actorUserId ?? null,
          eventType:   input.eventType,
          entityType:  input.entityType ?? null,
          entityId:    input.entityId ?? null,
          metadata:    input.metadata ?? null,
          ipAddress:   input.ipAddress ?? null,
          userAgent:   input.userAgent ?? null,
        })
        .returning();

      const created = rows[0];
      if (!created) throw AppError.internal("Audit event insert returned no rows.");
      return created;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create audit event: ${String(err)}`);
    }
  }
}
