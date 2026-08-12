import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { notifications } from "../../db/schema/index.js";
import type { Notification } from "../../db/schema/index.js";

export class NotificationsRepository {
  async create(data: {
    userId: string;
    type: string;
    title: string;
    message?: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
    expiresAt?: Date;
    waMeUrl?: string;
  }): Promise<Notification> {
    const rows = await db.insert(notifications).values({
      userId: data.userId,
      type:   data.type,
      title:  data.title,
      ...(data.message    !== undefined ? { message:    data.message    } : {}),
      ...(data.entityType !== undefined ? { entityType: data.entityType } : {}),
      ...(data.entityId   !== undefined ? { entityId:   data.entityId   } : {}),
      ...(data.actionUrl  !== undefined ? { actionUrl:  data.actionUrl  } : {}),
      ...(data.expiresAt  !== undefined ? { expiresAt:  data.expiresAt  } : {}),
      ...(data.waMeUrl    !== undefined ? { waMeUrl:    data.waMeUrl    } : {}),
    }).returning();
    if (!rows[0]) throw new Error("Insert returned no rows.");
    return rows[0];
  }

  async markAllRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async markRead(id: string, userId: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async dismiss(id: string, userId: string): Promise<void> {
    await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async countUnread(userId: string): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return rows[0]?.count ?? 0;
  }
}
