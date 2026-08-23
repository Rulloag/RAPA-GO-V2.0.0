import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MIGRATIONS = join(ROOT, "src/db/migrations");
const MANIFEST = join(ROOT, "scripts/manual-migrations/manifest.ts");

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("manual migration chain 0056-0058", () => {
  it("manifest declares ordered chain 0056 → 0057 → 0058", () => {
    const source = readFileSync(MANIFEST, "utf8");
    expect(source).toContain('id: "0056_vehicle_categories"');
    expect(source).toContain('id: "0057_comfort_vehicle_category"');
    expect(source).toContain('id: "0058_vehicle_capabilities"');
    expect(source.indexOf("0056_vehicle_categories")).toBeLessThan(
      source.indexOf("0057_comfort_vehicle_category"),
    );
    expect(source.indexOf("0057_comfort_vehicle_category")).toBeLessThan(
      source.indexOf("0058_vehicle_capabilities"),
    );
  });

  it("SQL files exist and have stable content checksums", () => {
    for (const file of [
      "0056_vehicle_categories.sql",
      "0057_comfort_vehicle_category.sql",
      "0058_vehicle_capabilities.sql",
    ]) {
      const sql = readFileSync(join(MIGRATIONS, file), "utf8");
      expect(sql.length).toBeGreaterThan(50);
      expect(sha256(sql)).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("0057 requires ON CONFLICT on (type, effective_from)", () => {
    const sql = readFileSync(
      join(MIGRATIONS, "0057_comfort_vehicle_category.sql"),
      "utf8",
    );
    expect(sql).toContain("ON CONFLICT (type, effective_from) DO NOTHING");
    expect(sql).toContain("comfort_fare_multiplier_bps");
    expect(sql).toContain("comfort_min_vehicle_year");
  });

  it("0058 backfills legacy categories including confort typo", () => {
    const sql = readFileSync(
      join(MIGRATIONS, "0058_vehicle_capabilities.sql"),
      "utf8",
    );
    expect(sql).toContain("capability_xl");
    expect(sql).toContain("capability_extra_luggage");
    expect(sql).toContain("capability_comfort");
    expect(sql).toContain("assigned_vehicle_plate");
    expect(sql).toMatch(/'comfort',\s*'confort'/);
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
  });

  it("journal still ends at 0047 (hybrid model preserved)", () => {
    const journal = readFileSync(
      join(MIGRATIONS, "meta/_journal.json"),
      "utf8",
    );
    expect(journal).toContain("0047_ride_requests_perf_indexes");
    expect(journal).not.toContain("0057_comfort_vehicle_category");
    expect(journal).not.toContain("0058_vehicle_capabilities");
  });
});
