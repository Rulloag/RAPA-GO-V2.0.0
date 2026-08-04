import { describe, expect, it } from "vitest";

import adminSource from "./index.tsx?raw";
import apiClientSource from "../../services/api/apiClient.ts?raw";

describe("admin rate-limit regressions", () => {
  it("does not poll the complete admin dashboard every three seconds", () => {
    expect(adminSource).not.toContain(
      "window.setInterval(refreshAvailability, 3000)",
    );
  });

  it("does not poll the drivers screen every 2.5 seconds", () => {
    expect(adminSource).not.toContain(
      "window.setInterval(refreshAvailability, 2500)",
    );
  });

  it("does not keep the driver compliance report polling while hidden", () => {
    expect(adminSource).not.toContain(
      "void loadDriverRestOverview(true);\n    }, 60_000)",
    );
  });

  it("blocks all GET requests for the current session after HTTP 429", () => {
    expect(apiClientSource).toContain("globalGetRateLimitCooldowns");
    expect(apiClientSource).toContain('new CustomEvent("api:rate-limited"');
  });

  it("keeps a manual dashboard refresh control", () => {
    expect(adminSource).toContain("Actualizar");
    expect(adminSource).toContain("onClick={() => void load()}");
  });
});
