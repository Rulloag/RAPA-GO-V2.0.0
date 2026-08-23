/**
 * Manifest of post-journal (manual) migrations that production must apply
 * AFTER `drizzle-kit migrate`.
 *
 * Context:
 * - `meta/_journal.json` ends at `0047_ride_requests_perf_indexes`.
 * - Files 0044–0046 and 0048–0058 exist on disk but are NOT in the journal.
 * - Historically they were applied (or intended to be applied) via SQL Editor /
 *   psql, not via drizzle-kit. See docs/release/MANUAL_MIGRATIONS_0056_0058_RUNBOOK.md.
 *
 * This manifest is intentionally NARROW: only the vehicle-category chain required
 * for the current product release (0056 → 0057 → 0058). Earlier orphans remain
 * documented debt and must NOT be auto-applied here without a dedicated precheck
 * (legal content migrations especially can fail or re-mutate).
 */

export type ManualMigrationEntry = {
  /** Stable unique id recorded in rapago_manual_migrations.id */
  id: string;
  /** Filename under apps/api/src/db/migrations/ */
  file: string;
  /** Human-readable purpose */
  description: string;
};

export const MANUAL_MIGRATIONS_TABLE = "rapago_manual_migrations";

/**
 * Ordered chain. Do not reorder after any environment has applied entries.
 */
export const MANUAL_MIGRATION_CHAIN: readonly ManualMigrationEntry[] = [
  {
    id: "0056_vehicle_categories",
    file: "0056_vehicle_categories.sql",
    description:
      "Adds requested/assigned/driver vehicle_category columns (IF NOT EXISTS).",
  },
  {
    id: "0057_comfort_vehicle_category",
    file: "0057_comfort_vehicle_category.sql",
    description:
      "Comfort category comments + fare_settings seeds (ON CONFLICT DO NOTHING).",
  },
  {
    id: "0058_vehicle_capabilities",
    file: "0058_vehicle_capabilities.sql",
    description:
      "Independent capability_* flags, legacy backfill, assigned_vehicle_plate.",
  },
] as const;

/**
 * Known SQL files on disk that are NOT in drizzle journal and NOT in this
 * auto-apply chain. Listed for audit / ops awareness only.
 */
export const KNOWN_ORPHAN_SQL_OUTSIDE_CHAIN: readonly string[] = [
  "0044_driver_application_assets.sql",
  "0045_driver_service_schedule_manual_rest.sql",
  "0046_clear_stale_driver_current_rides.sql",
  "0048_legal_acceptance_and_driver_contract_workflow.sql",
  "0049_publish_final_legal_documents.sql",
  "0050_enable_google_oauth_provider.sql",
  "0050_klap_webhook_delivery_reliability.sql",
  "0051_ride_receipts_and_driver_approval_email.sql",
  "0052_klap_deferred_capture.sql",
  "0053_lock_profile_identity.sql",
  "0054_auth_provider_privacy_alignment.sql",
  "0055_publish_definitive_legal_policies_20260813.sql",
] as const;
