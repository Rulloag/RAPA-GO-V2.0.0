import { describe, expect, it } from "vitest";
import { assertSafeCertificationDatabaseUrl } from "../testDatabaseGuard.js";

describe("testDatabaseGuard", () => {
  it("allows local CI postgres URLs", () => {
    expect(() =>
      assertSafeCertificationDatabaseUrl(
        "postgresql://postgres:postgres@localhost:5432/rapago_test",
        "unit",
      ),
    ).not.toThrow();
  });

  it("blocks production-like hosts", () => {
    expect(() =>
      assertSafeCertificationDatabaseUrl(
        "postgresql://user:pass@db.supabase.co:5432/postgres",
        "unit",
      ),
    ).toThrow(/Refusing to run against non-local DATABASE_URL/);
  });
});
