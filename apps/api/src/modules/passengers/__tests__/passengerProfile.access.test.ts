import { describe, expect, it } from "vitest";

import { canUsePassengerProfile } from "../passengerProfile.access.js";

describe("canUsePassengerProfile", () => {
  it("permite pasajeros y conductores que viajan como usuarios", () => {
    expect(canUsePassengerProfile("passenger")).toBe(true);
    expect(canUsePassengerProfile("driver")).toBe(true);
  });

  it("mantiene bloqueados los roles administrativos", () => {
    expect(canUsePassengerProfile("admin")).toBe(false);
    expect(canUsePassengerProfile("guide")).toBe(false);
  });
});
