/**
 * Apply post-journal manual migrations (0056 → 0057 → 0058).
 *
 * Usage:
 *   DATABASE_URL=… npx tsx scripts/apply-manual-migrations.ts
 *   DATABASE_URL=… npx tsx scripts/apply-manual-migrations.ts --dry-run
 *
 * NEVER point this at production without an authorized runbook execution.
 */
import "dotenv/config";
import postgres from "postgres";
import { applyManualMigrations } from "./manual-migrations/applyManualMigrations.js";
import {
  KNOWN_ORPHAN_SQL_OUTSIDE_CHAIN,
  MANUAL_MIGRATION_CHAIN,
} from "./manual-migrations/manifest.js";

const dryRun = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  throw new Error("Missing DATABASE_URL (or DIRECT_URL)");
}

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

console.log("🚀 manual migrations start");
console.log(
  `chain: ${MANUAL_MIGRATION_CHAIN.map((m) => m.id).join(" → ")}`,
);
console.log(
  `orphans outside auto-chain (not applied by this runner): ${KNOWN_ORPHAN_SQL_OUTSIDE_CHAIN.length}`,
);

const client = postgres(url, { max: 1 });

try {
  const result = await applyManualMigrations(client, { dryRun });
  console.log(
    `🎉 done applied=${result.applied.length} skipped=${result.skipped.length}` +
      (dryRun ? " (dry-run)" : ""),
  );
} finally {
  await client.end();
}
