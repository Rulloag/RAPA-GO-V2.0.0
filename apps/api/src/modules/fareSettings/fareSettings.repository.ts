import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { fareSettings, zoneFares } from "../../db/schema/index.js";
import type { FareSetting, ZoneFare } from "../../db/schema/index.js";

export class FareSettingsRepository {
  async findActive(): Promise<FareSetting[]> {
    return db.select().from(fareSettings)
      .where(eq(fareSettings.isActive, true))
      .orderBy(fareSettings.type);
  }

  async findByType(type: string): Promise<FareSetting | null> {
    const today = new Date().toISOString().split("T")[0]!;
    const rows = await db.select().from(fareSettings)
      .where(and(
        eq(fareSettings.type, type),
        eq(fareSettings.isActive, true),
      ))
      .orderBy(desc(fareSettings.effectiveFrom))
      .limit(10);
    const active = rows.filter(r => {
      if (r.effectiveFrom > today) return false;
      if (r.effectiveUntil && r.effectiveUntil < today) return false;
      return true;
    });
    return active[0] ?? null;
  }

  async findAll(): Promise<FareSetting[]> {
    return db.select().from(fareSettings).orderBy(desc(fareSettings.createdAt));
  }

  async findById(id: string): Promise<FareSetting | null> {
    const rows = await db.select().from(fareSettings).where(eq(fareSettings.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(data: {
    type: string; name: string; value: number; currency?: string;
    description?: string; effectiveFrom: string; effectiveUntil?: string; createdBy?: string;
  }): Promise<FareSetting> {
    const rows = await db.insert(fareSettings).values({
      type: data.type, name: data.name, value: data.value,
      currency: data.currency ?? "CLP",
      effectiveFrom: data.effectiveFrom,
      ...(data.description    ? { description:    data.description }    : {}),
      ...(data.effectiveUntil ? { effectiveUntil: data.effectiveUntil } : {}),
      ...(data.createdBy      ? { createdBy:      data.createdBy }      : {}),
    }).returning();
    if (!rows[0]) throw new Error("Insert returned no rows.");
    return rows[0];
  }

  async update(id: string, data: {
    name?: string; value?: number; isActive?: boolean;
    effectiveUntil?: string; description?: string;
  }): Promise<FareSetting | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name          !== undefined) set["name"]          = data.name;
    if (data.value         !== undefined) set["value"]         = data.value;
    if (data.isActive      !== undefined) set["isActive"]      = data.isActive;
    if (data.effectiveUntil !== undefined) set["effectiveUntil"] = data.effectiveUntil;
    if (data.description   !== undefined) set["description"]   = data.description;
    const rows = await db.update(fareSettings).set(set).where(eq(fareSettings.id, id)).returning();
    return rows[0] ?? null;
  }

  async closeActiveByType(type: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0]!;
    await db.update(fareSettings).set({ effectiveUntil: today, updatedAt: new Date() })
      .where(and(eq(fareSettings.type, type), eq(fareSettings.isActive, true)));
  }

  async findZoneFares(filters: { zoneFrom?: string; zoneTo?: string }): Promise<ZoneFare[]> {
    const conditions: ReturnType<typeof eq>[] = [eq(zoneFares.isActive, true)];
    if (filters.zoneFrom) conditions.push(eq(zoneFares.zoneFrom, filters.zoneFrom));
    if (filters.zoneTo)   conditions.push(eq(zoneFares.zoneTo,   filters.zoneTo));
    return db.select().from(zoneFares).where(and(...conditions)).orderBy(zoneFares.zoneFrom);
  }

  async upsertZoneFare(data: { zoneFrom: string; zoneTo: string; fare: number }): Promise<ZoneFare> {
    const rows = await db.insert(zoneFares).values(data)
      .onConflictDoUpdate({
        target: [zoneFares.zoneFrom, zoneFares.zoneTo],
        set: { fare: data.fare, updatedAt: new Date() },
      }).returning();
    if (!rows[0]) throw new Error("Upsert returned no rows.");
    return rows[0];
  }

  async updateZoneFare(id: string, data: { fare?: number; isActive?: boolean }): Promise<ZoneFare | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.fare     !== undefined) set["fare"]     = data.fare;
    if (data.isActive !== undefined) set["isActive"] = data.isActive;
    const rows = await db.update(zoneFares).set(set).where(eq(zoneFares.id, id)).returning();
    return rows[0] ?? null;
  }

  async findZoneFareByRoute(zoneFrom: string, zoneTo: string): Promise<ZoneFare | null> {
    const rows = await db.select().from(zoneFares)
      .where(and(eq(zoneFares.zoneFrom, zoneFrom), eq(zoneFares.zoneTo, zoneTo), eq(zoneFares.isActive, true)))
      .limit(1);
    return rows[0] ?? null;
  }
}
