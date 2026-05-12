import { AuditRepository } from "./audit.repository.js";
import type { AuditEvent, AuthAuditInput, UserAuditInput, CreateAuditEventInput } from "./audit.types.js";

/**
 * AuditService — helpers for recording structured audit events.
 * All writes are append-only and go through AuditRepository.
 *
 * Failures are intentionally non-fatal by default: a failing audit write
 * must never crash the main request. Call recordSafe() for fire-and-forget.
 * Call record() when you need to await and propagate the error.
 */
export class AuditService {
  private readonly repo: AuditRepository;

  constructor(repo?: AuditRepository) {
    this.repo = repo ?? new AuditRepository();
  }

  /** Awaitable — propagates errors. Use when audit is part of a transaction. */
  async record(input: CreateAuditEventInput): Promise<AuditEvent> {
    return this.repo.createEvent(input);
  }

  /**
   * Fire-and-forget — swallows errors and logs them.
   * Use for non-critical audit side-effects that must not block the response.
   */
  recordSafe(input: CreateAuditEventInput): void {
    this.repo.createEvent(input).catch((err: unknown) => {
      console.error("[AuditService] Failed to write audit event:", err);
    });
  }

  async recordAuthEvent(input: AuthAuditInput): Promise<AuditEvent> {
    const base: CreateAuditEventInput = {
      eventType:  input.eventType,
      entityType: "auth",
    };
    if (input.actorUserId !== undefined) base.actorUserId = input.actorUserId;
    if (input.metadata    !== undefined) base.metadata    = input.metadata;
    if (input.ipAddress   !== undefined) base.ipAddress   = input.ipAddress;
    if (input.userAgent   !== undefined) base.userAgent   = input.userAgent;
    return this.record(base);
  }

  async recordUserEvent(input: UserAuditInput): Promise<AuditEvent> {
    const base: CreateAuditEventInput = {
      eventType:  input.eventType,
      entityType: "user",
    };
    if (input.actorUserId !== undefined) base.actorUserId = input.actorUserId;
    if (input.entityId    !== undefined) base.entityId    = input.entityId;
    if (input.metadata    !== undefined) base.metadata    = input.metadata;
    if (input.ipAddress   !== undefined) base.ipAddress   = input.ipAddress;
    if (input.userAgent   !== undefined) base.userAgent   = input.userAgent;
    return this.record(base);
  }

  async recordSystemEvent(opts: {
    eventType: string;
    metadata?: CreateAuditEventInput["metadata"];
  }): Promise<AuditEvent> {
    const base: CreateAuditEventInput = {
      actorUserId: null,
      eventType:   opts.eventType,
      entityType:  "system",
    };
    if (opts.metadata !== undefined) base.metadata = opts.metadata;
    return this.record(base);
  }
}
