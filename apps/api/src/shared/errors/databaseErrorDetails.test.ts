import { describe, expect, it } from "vitest";
import { formatDatabaseErrorDetails, getDatabaseErrorDetails } from "./databaseErrorDetails.js";
describe("databaseErrorDetails", () => {
  it("extracts nested PostgreSQL metadata without SQL parameters", () => {
    const error = { query: "insert", params: ["secret-value"], cause: { code: "42703", message: 'column "payment_method" does not exist', table: "ride_requests", column: "payment_method" } };
    expect(getDatabaseErrorDetails(error)).toEqual({ code: "42703", message: 'column "payment_method" does not exist', detail: null, table: "ride_requests", column: "payment_method", constraint: null });
    const formatted = formatDatabaseErrorDetails(error);
    expect(formatted).toContain("code=42703");
    expect(formatted).toContain("column=payment_method");
    expect(formatted).not.toContain("secret-value");
  });
});
