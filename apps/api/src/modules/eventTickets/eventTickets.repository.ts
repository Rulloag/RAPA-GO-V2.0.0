import { desc, eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { eventTickets } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { EventTicket } from "../../db/schema/index.js";

export class EventTicketsRepository {
  async create(data: {
    userId: string;
    externalEventId: string;
    externalBookingId: string;
    eventName: string;
    eventDate?: string;
    eventLocation?: string;
    ticketCode: string;
    qrData: string;
  }): Promise<EventTicket> {
    const rows = await db.insert(eventTickets).values({
      userId: data.userId,
      externalEventId: data.externalEventId,
      externalBookingId: data.externalBookingId,
      eventName: data.eventName,
      ticketCode: data.ticketCode,
      qrData: data.qrData,
      ...(data.eventDate     ? { eventDate:     data.eventDate }     : {}),
      ...(data.eventLocation ? { eventLocation: data.eventLocation } : {}),
    }).returning();
    if (!rows[0]) throw AppError.internal("Insert returned no rows.");
    return rows[0];
  }

  async findByUser(userId: string): Promise<EventTicket[]> {
    return db.select().from(eventTickets)
      .where(eq(eventTickets.userId, userId))
      .orderBy(desc(eventTickets.createdAt));
  }

  async findById(id: string): Promise<EventTicket | null> {
    const rows = await db.select().from(eventTickets).where(eq(eventTickets.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByCode(code: string): Promise<EventTicket | null> {
    const rows = await db.select().from(eventTickets).where(eq(eventTickets.ticketCode, code)).limit(1);
    return rows[0] ?? null;
  }

  async validate(id: string, validatedBy: string): Promise<EventTicket | null> {
    const rows = await db.update(eventTickets)
      .set({ status: "used", validatedAt: new Date(), validatedBy, updatedAt: new Date() })
      .where(and(eq(eventTickets.id, id), eq(eventTickets.status, "active")))
      .returning();
    return rows[0] ?? null;
  }

  async findRecentValidations(): Promise<EventTicket[]> {
    return db.select().from(eventTickets)
      .where(eq(eventTickets.status, "used"))
      .orderBy(desc(eventTickets.validatedAt))
      .limit(50);
  }
}
