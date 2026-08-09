import { describe, expect, it } from "vitest";

import loginSource from "../LoginPage.tsx?raw";
import profileSource from "../../../pages/passenger/pages/ProfilePage.tsx?raw";
import deletionCardSource from "../../../components/accountDeletion/AccountDeletionCard.tsx?raw";
import publicDeletionSource from "../../../pages/public/PublicAccountDeletionPage.tsx?raw";
import routerSource from "../../../navigation/AppRouter.tsx?raw";
import legalGateSource from "../../legal/LegalReacceptanceGate.tsx?raw";

describe("final auth/deletion/legal closure", () => {
  it("keeps Facebook disabled in login, profile and routing", () => {
    expect(loginSource).toContain("const facebookLoginEnabled = false");
    expect(profileSource).not.toContain("Vincular Facebook");
    expect(profileSource).toContain("<strong>Google</strong>");
    expect(routerSource).not.toContain("FacebookCallbackPage");
  });

  it("requires an explicit reason for account deletion", () => {
    expect(deletionCardSource).toContain("Motivo (obligatorio)");
    expect(publicDeletionSource).toContain("Motivo (obligatorio)");
    expect(deletionCardSource).not.toContain("Prefiero no indicar el motivo");
    expect(publicDeletionSource).not.toContain("Prefiero no indicar el motivo");
  });

  it("provides a legal reacceptance gate for active versions", () => {
    expect(legalGateSource).toContain("Documentos actualizados");
    expect(legalGateSource).toContain("getMissingRequired");
    expect(legalGateSource).toContain("Aceptar documentos y continuar");
  });
});
