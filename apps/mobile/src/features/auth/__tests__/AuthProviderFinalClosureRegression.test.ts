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

  it("keeps the account-deletion reason optional", () => {
    expect(deletionCardSource).toContain("Motivo (opcional)");
    expect(publicDeletionSource).toContain("Motivo (opcional)");
    expect(deletionCardSource).toContain("Prefiero no indicar el motivo");
    expect(publicDeletionSource).toContain("Prefiero no indicar el motivo");
    expect(deletionCardSource).not.toContain("Motivo (obligatorio)");
    expect(publicDeletionSource).not.toContain("Motivo (obligatorio)");
  });

  it("provides a dismissible legal reacceptance notice without silently accepting", () => {
    expect(legalGateSource).toContain("Documentos y políticas actualizados");
    expect(legalGateSource).toContain("getMissingRequired");
    expect(legalGateSource).toContain("Aceptar documentos y continuar");
    expect(legalGateSource).toContain("Cerrar aviso de documentos actualizados");
    expect(legalGateSource).toContain("Cerrar la ventana no registra");
    expect(legalGateSource).toContain(
      "Tus documentos y políticas se actualizaron correctamente",
    );
    expect(legalGateSource).toContain("setCompleted(true)");
    expect(legalGateSource).not.toContain("backdropDismiss={true}");
  });
});
