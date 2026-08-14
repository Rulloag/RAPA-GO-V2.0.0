import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../db/migrations/0055_publish_definitive_legal_policies_20260813.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("definitive legal policy release 2026-08-13", () => {
  it("publishes the exact target versions", () => {
    expect(migration).toContain("'terms_and_conditions',\n      '4.0'");
    expect(migration).toContain("'user_conditions',\n      '1.1'");
    expect(migration).toContain("'privacy_policy',\n      '1.0'");
    expect(migration).toContain("'driver_conditions',\n      '2.1'");
  });

  it("keeps the final cancellation and account-deletion rules", () => {
    expect(migration).toContain("plazo de un minuto");
    expect(migration).toContain("treinta por ciento");
    expect(migration).toContain("$3.000");
    expect(migration).toContain("cinco minutos");
    expect(migration).toContain("$5.000");
    expect(migration).toContain("El motivo de eliminación será opcional");
    expect(migration).toContain("Prefiero no indicar");
  });

  it("publishes Klap, Google, Apple and the 23/77 driver economics", () => {
    expect(migration).toContain("Itaú Klap");
    expect(migration).toContain("Google Sign-In");
    expect(migration).toContain("Sign in with Apple");
    expect(migration).toContain("Facebook Login");
    expect(migration).toContain("23%");
    expect(migration).toContain("77%");
  });

  it("deactivates the previous active legal document before switching versions", () => {
    expect(
      migration.match(/AND \(target_id IS NULL OR id <> target_id\);/g),
    ).toHaveLength(4);

    expect(migration).toContain(
      "WHERE type = 'terms_and_conditions'\n    AND is_active = true\n    AND (target_id IS NULL OR id <> target_id);",
    );
    expect(migration).toContain(
      "WHERE type = 'user_conditions'\n    AND is_active = true\n    AND (target_id IS NULL OR id <> target_id);",
    );
    expect(migration).toContain(
      "WHERE type = 'privacy_policy'\n    AND is_active = true\n    AND (target_id IS NULL OR id <> target_id);",
    );
    expect(migration).toContain(
      "WHERE type = 'driver_conditions'\n    AND is_active = true\n    AND (target_id IS NULL OR id <> target_id);",
    );
  });
});
