import {
  IonButton,
  IonContent,
  IonPage,
  IonSpinner,
  IonText,
} from "@ionic/react";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import { ROUTES } from "../../navigation/routes.js";
import { getReleaseHome } from "../../config/releaseFeatures.js";
import { sessionStorageService } from "./sessionStorage.service.js";
import { authService } from "./auth.service.js";

type CallbackState = "loading" | "error";

function getFacebookCallbackErrorMessage(code: string): string {
  if (code === "missing_exchange") {
    return "Facebook no devolvió un código de ingreso válido. Intenta nuevamente.";
  }

  if (code === "exchange_failed") {
    return "El inicio con Facebook expiró o ya fue utilizado. Intenta nuevamente.";
  }

  if (code === "save_failed") {
    return "No se pudo guardar la sesión de forma segura en este dispositivo.";
  }

  return "No se pudo iniciar sesión con Facebook. Intenta nuevamente.";
}

export function FacebookCallbackPage(): JSX.Element {
  const history = useHistory();
  const location = useLocation();
  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const fragmentParams = useMemo(
    () =>
      new URLSearchParams(
        location.hash.startsWith("#")
          ? location.hash.slice(1)
          : location.hash,
      ),
    [location.hash],
  );

  useEffect(() => {
    let cancelled = false;

    async function finishFacebookLogin(): Promise<void> {
      const exchangeCode =
        queryParams.get("exchangeCode")?.trim() ??
        fragmentParams.get("exchangeCode")?.trim() ??
        "";

      // Remove the one-time code from browser history immediately.
      window.history.replaceState(
        null,
        document.title,
        ROUTES.AUTH.FACEBOOK_CALLBACK,
      );

      if (!exchangeCode) {
        if (cancelled) return;
        setState("error");
        setErrorMessage(
          getFacebookCallbackErrorMessage("missing_exchange"),
        );
        return;
      }

      const result = await authService.exchangeFacebookLogin(exchangeCode);

      if (result.ok === false) {
        if (cancelled) return;
        setState("error");
        setErrorMessage(
          result.message ||
            getFacebookCallbackErrorMessage("exchange_failed"),
        );
        return;
      }

      try {
        await sessionStorageService.saveSession(result.session);

        if (cancelled) return;

        window.location.replace(getReleaseHome(result.session.user.role));
      } catch {
        await authService
          .logout(result.session.accessToken)
          .catch(() => {});

        if (cancelled) return;
        setState("error");
        setErrorMessage(
          getFacebookCallbackErrorMessage("save_failed"),
        );
      }
    }

    void finishFacebookLogin().catch(() => {
      if (cancelled) return;
      setState("error");
      setErrorMessage(
        getFacebookCallbackErrorMessage("exchange_failed"),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [fragmentParams, queryParams]);

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