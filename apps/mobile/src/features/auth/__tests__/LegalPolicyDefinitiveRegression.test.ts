import { describe, expect, it } from "vitest";

import registerSource from "../RegisterPage.tsx?raw";
import socialSetupSource from "../PassengerSocialSetupForm.tsx?raw";
import deletionCardSource from "../../../components/accountDeletion/AccountDeletionCard.tsx?raw";
import publicDeletionSource from "../../../pages/public/PublicAccountDeletionPage.tsx?raw";

describe("definitive legal UI release 2026-08-13", () => {
  it("shows the final passenger acceptance package", () => {
    expect(registerSource).toContain('registrationLegalVersion("privacy_policy")');
    expect(socialSetupSource).toContain("versión 4.0");
    expect(socialSetupSource).toContain("versión 1.1");
    expect(socialSetupSource).toContain("versión 1.0");
    expect(socialSetupSource).toContain("Divulgación de geolocalización");
  });

  it("keeps the account-deletion reason optional", () => {
    expect(deletionCardSource).toContain("Motivo (opcional)");
    expect(publicDeletionSource).toContain("Motivo (opcional)");
    expect(deletionCardSource).toContain("Prefiero no indicar el motivo");
    expect(publicDeletionSource).toContain("Prefiero no indicar el motivo");
  });
});
