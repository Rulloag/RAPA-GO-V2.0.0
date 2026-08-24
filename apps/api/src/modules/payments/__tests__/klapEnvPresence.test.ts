import { describe, expect, it } from "vitest";
import { inspectKlapEnvPresence } from "../klap.provider.js";

describe("Klap env presence", () => {
  it("reports DEFINED/MISSING/SANDBOX/PRODUCTION without secret values", () => {
    process.env["KLAP_ENVIRONMENT"] = "sandbox";
    process.env["KLAP_API_KEY"] = "not-a-real-secret";
    delete process.env["KLAP_WEBHOOK_CONFIRM_URL"];

    const presence = inspectKlapEnvPresence();

    expect(presence.KLAP_ENVIRONMENT).toBe("SANDBOX");
    expect(presence.KLAP_API_KEY).toBe("DEFINED");
    expect(presence.KLAP_WEBHOOK_CONFIRM_URL).toBe("MISSING");
    expect(JSON.stringify(presence)).not.toContain("not-a-real-secret");
  });
});
