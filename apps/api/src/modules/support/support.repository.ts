import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db/client.js";
import {
  driverProfiles,
  passengerProfiles,
  supportCaseEvents,
  supportCases,
  users,
} from "../../db/schema/index.js";
import type {
  NewSupportCase,
  SupportCase,
  SupportCaseEvent,
} from "../../db/schema/supportCases.schema.js";
import type {
  AdminIdentityCorrectionInput,
  AdminSupportListQuery,
  SupportPriority,
  SupportStatus,
} from "./support.schemas.js";
import type { SupportCaseWithRequester } from "./support.types.js";

export interface AdminSupportPatch {
  status?: SupportStatus;
  priority?: SupportPriority;
  assignedAdminUserId?: string | null;
  adminResolution?: string | null;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
}


export interface SupportRequesterIdentityRecord {
  userId: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  rut: string | null;
  birthDate: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
}

export interface SupportEventInput {
  actorUserId: string | null;
  actorRole: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  publicMessage?: string | null;
  internalNote?: string | null;
}

const requester = alias(users, "support_requester");
const assignedAdmin = alias(users, "support_assigned_admin");

const adminSelection = {
  id: supportCases.id,
  trackingCode: supportCases.trackingCode,
  requesterUserId: supportCases.requesterUserId,
  requesterRole: supportCases.requesterRole,
  rideRequestId: supportCases.rideRequestId,
  category: supportCases.category,
  subject: supportCases.subject,
  description: supportCases.description,
  priority: supportCases.priority,
  status: supportCases.status,
  contactPhone: supportCases.contactPhone,
  contactEmail: supportCases.contactEmail,
  lostItemDescription: supportCases.lostItemDescription,
  lostItemLastSeenAt: supportCases.lostItemLastSeenAt,
  assignedAdminUserId: supportCases.assignedAdminUserId,
  adminResolution: supportCases.adminResolution,
  firstResponseAt: supportCases.firstResponseAt,
  resolvedAt: supportCases.resolvedAt,
  closedAt: supportCases.closedAt,
  createdAt: supportCases.createdAt,
  updatedAt: supportCases.updatedAt,
  requesterName: requester.name,
  requesterEmail: requester.email,
  assignedAdminName: assignedAdmin.name,
};

export class SupportRepository {
  async createCase(
    input: NewSupportCase,
    actorRole: string,
  ): Promise<SupportCase> {
    return db.transaction(async (tx) => {
      const rows = await tx.insert(supportCases).values(input).returning();
      const created = rows[0];
      if (!created) throw new Error("Support case insert returned no rows.");

      await tx.insert(supportCaseEvents).values({
        supportCaseId: created.id,
        actorUserId: created.requesterUserId,
        actorRole,
        eventType: "case_created",
        toStatus: created.status,
        publicMessage: "Solicitud recibida por RAPA GO.",
      });

      return created;
    });
  }

  async findById(id: string): Promise<SupportCase | null> {
    const rows = await db
      .select()
      .from(supportCases)
      .where(eq(supportCases.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByIdWithRequester(
    id: string,
  ): Promise<SupportCaseWithRequester | null> {
    const rows = await db
      .select(adminSelection)
      .from(supportCases)
      .innerJoin(requester, eq(supportCases.requesterUserId, requester.id))
      .leftJoin(
        assignedAdmin,
        eq(supportCases.assignedAdminUserId, assignedAdmin.id),
      )
      .where(eq(supportCases.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByRequester(userId: string): Promise<SupportCaseWithRequester[]> {
    return db
      .select(adminSelection)
      .from(supportCases)
      .innerJoin(requester, eq(supportCases.requesterUserId, requester.id))
      .leftJoin(
        assignedAdmin,
        eq(supportCases.assignedAdminUserId, assignedAdmin.id),
      )
      .where(eq(supportCases.requesterUserId, userId))
      .orderBy(desc(supportCases.updatedAt))
      .limit(100);
  }

  async listForAdmin(
    filters: AdminSupportListQuery,
  ): Promise<SupportCaseWithRequester[]> {
    const conditions: SQL[] = [];
    if (filters.status) conditions.push(eq(supportCases.status, filters.status));
    if (filters.category) conditions.push(eq(supportCases.category, filters.category));
    if (filters.priority) conditions.push(eq(supportCases.priority, filters.priority));
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      const searchCondition = or(
        ilike(supportCases.trackingCode, pattern),
        ilike(supportCases.subject, pattern),
        ilike(requester.name, pattern),
        ilike(requester.email, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const base = db
      .select(adminSelection)
      .from(supportCases)
      .innerJoin(requester, eq(supportCases.requesterUserId, requester.id))
      .leftJoin(
        assignedAdmin,
        eq(supportCases.assignedAdminUserId, assignedAdmin.id),
      );

    if (conditions.length > 0) {
      return base
        .where(and(...conditions))
        .orderBy(desc(supportCases.updatedAt))
        .limit(filters.limit);
    }

    return base.orderBy(desc(supportCases.updatedAt)).limit(filters.limit);
  }

  async listEvents(caseId: string): Promise<SupportCaseEvent[]> {
    return db
      .select()
      .from(supportCaseEvents)
      .where(eq(supportCaseEvents.supportCaseId, caseId))
      .orderBy(asc(supportCaseEvents.createdAt));
  }

  async addRequesterMessage(input: {
    supportCaseId: string;
    actorUserId: string;
    actorRole: string;
    message: string;
    fromStatus: string;
    toStatus: string;
  }): Promise<void> {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(supportCases)
        .set({ status: input.toStatus, updatedAt: now })
        .where(eq(supportCases.id, input.supportCaseId));

      await tx.insert(supportCaseEvents).values({
        supportCaseId: input.supportCaseId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        eventType: "requester_message",
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        publicMessage: input.message,
      });
    });
  }

  async updateByAdmin(input: {
    supportCaseId: string;
    actorUserId: string;
    actorRole: string;
    fromStatus: string;
    patch: AdminSupportPatch;
    event: SupportEventInput;
  }): Promise<SupportCase | null> {
    const now = new Date();
    return db.transaction(async (tx) => {
      const rows = await tx
        .update(supportCases)
        .set({ ...input.patch, updatedAt: now })
        .where(eq(supportCases.id, input.supportCaseId))
        .returning();
      const updated = rows[0] ?? null;
      if (!updated) return null;

      await tx.insert(supportCaseEvents).values({
        supportCaseId: input.supportCaseId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        eventType: input.event.eventType,
        fromStatus: input.event.fromStatus ?? input.fromStatus,
        toStatus: input.event.toStatus ?? updated.status,
        publicMessage: input.event.publicMessage ?? null,
        internalNote: input.event.internalNote ?? null,
      });

      return updated;
    });
  }

  async findRequesterIdentity(
    userId: string,
  ): Promise<SupportRequesterIdentityRecord | null> {
    const [userRows, passengerRows, driverRows] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db
        .select()
        .from(passengerProfiles)
        .where(eq(passengerProfiles.userId, userId))
        .limit(1),
      db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId))
        .limit(1),
    ]);

    const user = userRows[0];
    if (!user) return null;

    const passengerProfile = passengerRows[0] ?? null;
    const driverProfile = driverRows[0] ?? null;

    return {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: driverProfile?.phone ?? passengerProfile?.phone ?? null,
      rut: passengerProfile?.rut ?? null,
      birthDate: passengerProfile?.birthDate ?? null,
      licenseNumber: driverProfile?.licenseNumber ?? null,
      licenseExpiry: driverProfile?.licenseExpiry ?? null,
    };
  }

  async updateRequesterIdentityByAdmin(input: {
    supportCaseId: string;
    requesterUserId: string;
    requesterRole: string;
    actorUserId: string;
    correction: AdminIdentityCorrectionInput;
  }): Promise<SupportRequesterIdentityRecord | null> {
    const now = new Date();
    const changedFields = Object.entries(input.correction)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    await db.transaction(async (tx) => {
      const userPatch: Record<string, unknown> = { updatedAt: now };
      if (input.correction.name !== undefined) {
        userPatch["name"] = input.correction.name;
      }
      if (input.correction.email !== undefined) {
        userPatch["email"] = input.correction.email.toLowerCase();
      }

      if (Object.keys(userPatch).length > 1) {
        await tx
          .update(users)
          .set(userPatch)
          .where(eq(users.id, input.requesterUserId));
      }

      if (
        input.correction.phone !== undefined ||
        input.correction.rut !== undefined
      ) {
        await tx
          .insert(passengerProfiles)
          .values({
            userId: input.requesterUserId,
            ...(input.correction.phone !== undefined
              ? { phone: input.correction.phone }
              : {}),
            ...(input.correction.rut !== undefined
              ? { rut: input.correction.rut }
              : {}),
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: passengerProfiles.userId,
            set: {
              ...(input.correction.phone !== undefined
                ? { phone: input.correction.phone }
                : {}),
              ...(input.correction.rut !== undefined
                ? { rut: input.correction.rut }
                : {}),
              updatedAt: now,
            },
          });
      }

      if (
        input.requesterRole === "driver" &&
        (input.correction.phone !== undefined ||
          input.correction.licenseNumber !== undefined ||
          input.correction.licenseExpiry !== undefined)
      ) {
        await tx
          .insert(driverProfiles)
          .values({
            userId: input.requesterUserId,
            ...(input.correction.phone !== undefined
              ? { phone: input.correction.phone }
              : {}),
            ...(input.correction.licenseNumber !== undefined
              ? { licenseNumber: input.correction.licenseNumber }
              : {}),
            ...(input.correction.licenseExpiry !== undefined
              ? { licenseExpiry: input.correction.licenseExpiry }
              : {}),
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: driverProfiles.userId,
            set: {
              ...(input.correction.phone !== undefined
                ? { phone: input.correction.phone }
                : {}),
              ...(input.correction.licenseNumber !== undefined
                ? { licenseNumber: input.correction.licenseNumber }
                : {}),
              ...(input.correction.licenseExpiry !== undefined
                ? { licenseExpiry: input.correction.licenseExpiry }
                : {}),
              updatedAt: now,
            },
          });
      }

      await tx.insert(supportCaseEvents).values({
        supportCaseId: input.supportCaseId,
        actorUserId: input.actorUserId,
        actorRole: "admin",
        eventType: "identity_corrected",
        internalNote: `Campos corregidos administrativamente: ${changedFields.join(", ")}.`,
      });
    });

    return this.findRequesterIdentity(input.requesterUserId);
  }

  async findActiveAdminIds(): Promise<string[]> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.status, "active")));
    return rows.map((row) => row.id);
  }
}
