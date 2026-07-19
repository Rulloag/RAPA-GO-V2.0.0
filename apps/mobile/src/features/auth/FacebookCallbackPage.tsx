import { IonButton, IonContent, IonPage, IonSpinner, IonText } from "@ionic/react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useHistory, useLocation } from "react-router-dom";
import type { UserRole } from "@rapa-go/shared";
import { ROUTES } from "../../navigation/routes.js";
import { sessionStorageService } from "./sessionStorage.service.js";
import { legalService } from "../legal/legal.service.js";
import type { AuthSession } from "./auth.types.js";

const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin: ROUTES.ADMIN.HOME,
};

const VALID_ROLES = new Set<UserRole>([
  "passenger",
  "driver",
  "guide",
  "rental_operator",
  "admin",
]);

type CallbackState = "loading" | "error";

const RAPAGO_FACEBOOK_LEGAL_ACCEPTANCES_KEY =
  "rapago_pending_facebook_legal_acceptances_v1";

const RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES = new Set([
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
]);

type PendingFacebookLegalAcceptance = {
  legalDocumentId: string;
  type: string;
  version: string;
  title: string;
};

function readPendingFacebookLegalAcceptances():
  PendingFacebookLegalAcceptance[] {
  try {
    const raw = localStorage.getItem(
      RAPAGO_FACEBOOK_LEGAL_ACCEPTANCES_KEY,
    );
    const parsed = raw
      ? (JSON.parse(raw) as unknown)
      : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (
        item,
      ): item is PendingFacebookLegalAcceptance => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;

        return (
          typeof record.legalDocumentId === "string" &&
          typeof record.type === "string" &&
          RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES.has(
            record.type,
          ) &&
          typeof record.version === "string" &&
          typeof record.title === "string"
        );
      },
    );
  } catch {
    return [];
  }
}

async function acceptPendingFacebookLegalDocuments(
  accessToken: string,
): Promise<void> {
  const pending = readPendingFacebookLegalAcceptances();

  const foundTypes = new Set(
    pending.map((item) => item.type),
  );

  if (
    pending.length !==
      RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES.size ||
    [...RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES].some(
      (type) => !foundTypes.has(type),
    )
  ) {
    throw new Error("legal_missing");
  }

  const current =
    await legalService.getMyAcceptances(accessToken);

  for (const document of pending) {
    const alreadyAccepted = current.some(
      (acceptance) =>
        acceptance.legalDocumentId ===
          document.legalDocumentId &&
        acceptance.versionAccepted ===
          document.version,
    );

    if (alreadyAccepted) continue;

    await legalService.accept(
      accessToken,
      document.legalDocumentId,
      document.version,
    );
  }

  localStorage.removeItem(
    RAPAGO_FACEBOOK_LEGAL_ACCEPTANCES_KEY,
  );
}

function normalizeCallbackText(value: string | null): string {
  try {
    return decodeURIComponent(String(value ?? "")).trim();
  } catch {
    return String(value ?? "").trim();
  }
}

function isValidUserRole(value: string | null): value is UserRole {
  return Boolean(value && VALID_ROLES.has(value as UserRole));
}

function getFacebookCallbackErrorMessage(code: string | null): string {
  if (code === "missing_session") {
    return "Facebook no devolvió una sesión válida. Intenta iniciar sesión nuevamente.";
  }

  if (code === "invalid_role") {
    return "Facebook devolvió un rol inválido. Intenta nuevamente o entra con correo.";
  }

  if (code === "save_failed") {
    return "No se pudo guardar la sesión en este dispositivo. Limpia caché e intenta nuevamente.";
  }

  if (code === "legal_missing") {
    return "Debes aceptar Términos, Privacidad y Condiciones para Usuarios antes de continuar con Facebook.";
  }

  if (code === "legal_save_failed") {
    return "No se pudo registrar tu aceptación legal. Vuelve al login, marca las tres casillas e intenta nuevamente.";
  }

  if (code === "cancelled") {
    return "Inicio con Facebook cancelado.";
  }

  return "No se pudo iniciar sesión con Facebook. Intenta nuevamente.";
}

export function FacebookCallbackPage(): JSX.Element {
  const history = useHistory();
  const location = useLocation();
  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    let cancelled = false;

    async function finishFacebookLogin(): Promise<void> {
      const error = params.get("error");

      if (error) {
        if (cancelled) return;

        setState("error");
        setErrorMessage(getFacebookCallbackErrorMessage(error));
        return;
      }

      const accessToken = normalizeCallbackText(params.get("accessToken"));
      const expiresAt = normalizeCallbackText(params.get("expiresAt"));
      const userId = normalizeCallbackText(params.get("userId"));
      const email = normalizeCallbackText(params.get("email"));
      const name = normalizeCallbackText(params.get("name"));
      const roleParam = normalizeCallbackText(params.get("role"));
      const avatarUrl = normalizeCallbackText(params.get("avatarUrl")) || null;
      const isVerified = params.get("isVerified") === "true";

      if (!accessToken || !expiresAt || !userId || !email || !name || !roleParam) {
        if (cancelled) return;

        setState("error");
        setErrorMessage(getFacebookCallbackErrorMessage("missing_session"));
        return;
      }

      if (!isValidUserRole(roleParam)) {
        if (cancelled) return;

        setState("error");
        setErrorMessage(getFacebookCallbackErrorMessage("invalid_role"));
        return;
      }

      const session: AuthSession = {
        accessToken,
        expiresAt,
        user: {
          id: userId,
          email,
          name,
          role: roleParam,
          avatarUrl,
          isVerified,
        },
      };

      try {
        await acceptPendingFacebookLegalDocuments(
          accessToken,
        );
      } catch (error) {
        if (cancelled) return;

        setState("error");
        setErrorMessage(
          getFacebookCallbackErrorMessage(
            error instanceof Error &&
              error.message === "legal_missing"
              ? "legal_missing"
              : "legal_save_failed",
          ),
        );
        return;
      }

      try {
        await sessionStorageService.saveSession(session);

        const home = ROLE_HOME[roleParam] ?? ROUTES.PASSENGER.HOME;

        window.history.replaceState(null, document.title, home);
        window.location.replace(home);
      } catch {
        if (cancelled) return;

        setState("error");
        setErrorMessage(getFacebookCallbackErrorMessage("save_failed"));
      }
    }

    void finishFacebookLogin();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const pageStyle = {
    "--background":
      "linear-gradient(180deg, rgba(20,16,12,.72), rgba(20,16,12,.90)), url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed",
  } as CSSProperties;

  const cardStyle: CSSProperties = {
    width: "min(92vw, 440px)",
    margin: "14vh auto 0",
    padding: "26px 22px",
    borderRadius: 28,
    background: "linear-gradient(180deg, rgba(26,26,25,.97), rgba(15,15,15,.99))",
    border: "1px solid rgba(214,166,64,.34)",
    boxShadow: "0 24px 70px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.08)",
    color: "#F6F2EC",
    textAlign: "center",
  };

  const titleStyle: CSSProperties = {
    margin: "12px 0 6px",
    color: "#F8D879",
    fontSize: "1.35rem",
    fontWeight: 950,
  };

  const textStyle: CSSProperties = {
    margin: "0",
    color: "rgba(246,242,236,.76)",
    fontWeight: 750,
    lineHeight: 1.4,
  };

  if (state === "error") {
    return (
      <IonPage>
        <IonContent className="ion-padding" style={pageStyle}>
          <div style={cardStyle}>
            <div style={{ fontSize: "2.4rem" }}>⚠️</div>

            <IonText>
              <h2 style={titleStyle}>No se pudo entrar con Facebook</h2>
            </IonText>

            <IonText>
              <p style={textStyle}>{errorMessage}</p>
            </IonText>

            <IonButton
              expand="block"
              style={
                {
                  marginTop: 20,
                  "--border-radius": "18px",
                  "--background": "linear-gradient(135deg,#F8D879 0%,#D6A640 48%,#B84F2E 100%)",
                  "--color": "#111",
                  fontWeight: 950,
                  height: "50px",
                } as CSSProperties
              }
              onClick={() => history.replace(ROUTES.AUTH.LOGIN)}
            >
              Volver al login
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="ion-padding" style={pageStyle}>
        <div style={cardStyle}>
          <IonSpinner name="crescent" color="warning" />

          <IonText>
            <h2 style={titleStyle}>Iniciando sesión con Facebook</h2>
          </IonText>

          <IonText>
            <p style={textStyle}>Estamos validando tu sesión y preparando tu perfil.</p>
          </IonText>
        </div>
      </IonContent>
    </IonPage>
  );
}