import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import {
  MANUAL_MIGRATION_CHAIN,
  MANUAL_MIGRATIONS_TABLE,
  type ManualMigrationEntry,
} from "./manifest.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "../../src/db/migrations");

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function loadMigrationSql(entry: ManualMigrationEntry): {
  sql: string;
  checksum: string;
  absolutePath: string;
} {
  const absolutePath = join(MIGRATIONS_DIR, entry.file);
  const sql = readFileSync(absolutePath, "utf8");
  return { sql, checksum: sha256Hex(sql), absolutePath };
}

async function ensureRegistry(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${MANUAL_MIGRATIONS_TABLE} (
      id text PRIMARY KEY,
      file_name text NOT NULL,
      checksum_sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

type AppliedRow = { id: string; checksum_sha256: string };

async function listApplied(sql: postgres.Sql): Promise<Map<string, string>> {
  const rows = await sql.unsafe(
    `SELECT id, checksum_sha256 FROM ${MANUAL_MIGRATIONS_TABLE}`,
  ) as unknown as AppliedRow[];
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.id, row.checksum_sha256);
  }
  return map;
}

/**
 * Apply pending entries from MANUAL_MIGRATION_CHAIN.
 * - Skips ids already recorded with the same checksum.
 * - Fails hard if an applied id has a different checksum (drift).
 * - Runs each migration file inside a single transaction with registry insert.
 */
export async function applyManualMigrations(
  sql: postgres.Sql,
  options: { dryRun?: boolean } = {},
): Promise<{
  applied: string[];
  skipped: string[];
}> {
  await ensureRegistry(sql);
  const appliedMap = await listApplied(sql);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const entry of MANUAL_MIGRATION_CHAIN) {
    const { sql: body, checksum } = loadMigrationSql(entry);
    const previous = appliedMap.get(entry.id);

    if (previous) {
      if (previous !== checksum) {
        throw new Error(
          `Manual migration checksum drift for ${entry.id}: ` +
            `registry=${previous.slice(0, 12)}… file=${checksum.slice(0, 12)}…. ` +
            `Refusing to re-apply. Investigate before continuing.`,
        );
      }
      skipped.push(entry.id);
      console.log(`⏭️  skip ${entry.id} (already applied, checksum ok)`);
      continue;
    }

    if (options.dryRun) {
      console.log(`🔍 dry-run would apply ${entry.id} (${entry.file})`);
      applied.push(entry.id);
      continue;
    }

    console.log(`⏳ apply ${entry.id} (${entry.file})…`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx.unsafe(
        `INSERT INTO rapago_manual_migrations (id, file_name, checksum_sha256)
         VALUES ($1, $2, $3)`,
        [entry.id, entry.file, checksum],
      );
    });
    applied.push(entry.id);
    console.log(`✅ applied ${entry.id}`);
  }

  return { applied, skipped };
}
