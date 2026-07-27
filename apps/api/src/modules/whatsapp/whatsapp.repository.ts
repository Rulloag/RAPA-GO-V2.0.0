import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { whatsappMessages } from "../../db/schema/index.js";
import type { WhatsappMessage } from "../../db/schema/index.js";
import type { CreateWaMessageInput, WaStatus } from "./whatsapp.types.js";

export class WhatsappRepository {
  async createMessage(input: CreateWaMessageInput): Promise<WhatsappMessage> {
    const rows = await db
      .insert(whatsappMessages)
      .values({
        userId:            input.userId            ?? null,
        rideId:            input.rideId            ?? null,
        phoneE164:         input.phoneE164,
        direction:         input.direction,
        messageType:       input.messageType,
        providerMessageId: input.providerMessageId ?? null,
        templateName:      input.templateName      ?? null,
        bodyPreview:       input.bodyPreview        ?? null,
        status:            input.status,
        payloadJson:       (input.payloadJson as Record<string, unknown>) ?? null,
        errorCode:         input.errorCode         ?? null,
        errorMessage:      input.errorMessage      ?? null,
      })
      .returning();
    return rows[0]!;
  }

  async findByProviderMessageId(providerMessageId: string): Promise<WhatsappMessage | null> {
    const rows = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.providerMessageId, providerMessageId))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateStatusByProviderMessageId(
    providerMessageId: string,
    status: WaStatus,
    payloadJson?: unknown,
  ): Promise<WhatsappMessage | null> {
    const updates: Partial<typeof whatsappMessages.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };
    if (payloadJson !== undefined) {
      updates.payloadJson = payloadJson as Record<string, unknown>;
    }
    const rows = await db
      .update(whatsappMessages)
      .set(updates)
      .where(eq(whatsappMessages.providerMessageId, providerMessageId))
      .returning();
    return rows[0] ?? null;
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<WhatsappMessage | null> {
    const rows = await db
      .update(whatsappMessages)
      .set({ status: "failed", errorCode, errorMessage, updatedAt: new Date() })
      .where(eq(whatsappMessages.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async listRecentByPhone(
    phoneE164: string,
    limitCount = 20,
  ): Promise<WhatsappMessage[]> {
    return db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.phoneE164, phoneE164))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limitCount);
  }
}
