import { useState, type CSSProperties, type FormEvent } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
} from "@ionic/react";
import { arrowBackOutline, moonOutline, sunnyOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { useRapagoSectionTheme } from "../../theme/rapagoTheme.js";
import { ROUTES } from "../../navigation/routes.js";
import logoRapago from "../../theme/img/logo-rapago.jpeg";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "https://api.rapago.cl"
).replace(/\/$/, "");

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* Llega desde el registro cuando el correo ya tenía cuenta: precarga el campo
   para que la persona no tenga que volver a escribirlo. Solo se lee al montar. */
function getPrefillEmailFromQuery(): string {
  try {
    const value = new URLSearchParams(window.location.search).get("email");
    return value ? normalizeEmail(value) : "";
  } catch {
    return "";
  }
}

export function ForgotPasswordPage(): JSX.Element {
  const history = useHistory();
  /* Tema propio del flujo de acceso (compartido con Login y Registro). */
  const { theme, isDark, toggleTheme } = useRapagoSectionTheme("auth");

  const [email, setEmail] = useState(getPrefillEmailFromQuery());
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);

    setFieldError("");
    setServerError("");

    if (!normalizedEmail) {
      setFieldError("Ingresa tu correo electrónico.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setFieldError("Ingresa un correo electrónico válido.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/password/forgot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      if (response.status === 404) {
        throw new Error(
          "La recuperación automática todavía no está activada en el servidor.",
        );
      }

      if (!response.ok) {
        let message = "No fue posible enviar el enlace. Intenta nuevamente.";

        try {
          const body = (await response.json()) as {
            message?: string;
          };

          if (body.message) {
            message = body.message;
          }
        } catch {
          // Mantiene el mensaje genérico.
        }

        throw new Error(message);
      }

      setSent(true);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "No fue posible enviar el enlace. Intenta nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  const pageStyle = {
    "--background":
      "linear-gradient(180deg, rgba(20,16,12,.72), rgba(20,16,12,.86)), url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed",
  } as CSSProperties;

  /* Mismo encabezado que Login/Registro: va DENTRO de la tarjeta, arriba del
     título, en la grilla 42px/1fr/42px que ya define global.css. */
  const brandHeader = (
    <div className="rapago-auth-brand-header">
      <button
        type="button"
        className="rapago-auth-back-button"
        onClick={() => history.replace(ROUTES.AUTH.LOGIN)}
        aria-label="Volver al inicio de sesión"
      >
        <IonIcon icon={arrowBackOutline} />
      </button>

      <div className="rapago-auth-brand-logo-wrap">
        <img
          src={logoRapago}
          alt="Rapa Go"
          className="passenger-home-logo rapago-auth-brand-logo"
        />
      </div>

      <button
        type="button"
        className="rapago-auth-theme-btn"
        onClick={toggleTheme}
        aria-label={isDark ? "Activar modo día" : "Activar modo nocturno"}
        title={isDark ? "Modo día" : "Modo nocturno"}
      >
        <IonIcon icon={isDark ? sunnyOutline : moonOutline} />
      </button>
    </div>
  );

  return (
    <IonPage className="rapago-auth-dark" data-rapago-theme={theme}>
      <IonContent className="ion-padding rapago-forgot-content" style={pageStyle}>
        {sent ? (
          <div className="rapago-auth-card">
            {brandHeader}

            <IonText>
              <h2 className="rapago-auth-title">Revisa tu correo</h2>
            </IonText>

            <p className="rapago-auth-tagline">
              Si el correo está registrado, recibirás un enlace para crear una
              contraseña nueva. El enlace tendrá una duración limitada.
            </p>

            <IonButton
              expand="block"
              type="button"
              className="rapago-auth-btn-primary"
              onClick={() => history.replace(ROUTES.AUTH.LOGIN)}
            >
              Volver al inicio de sesión
            </IonButton>
          </div>
        ) : (
          /* La clase va en el <form>, no en un div contenedor: global.css:302
             pinta con !important cualquier <form> sin clase, y anidarlo dentro
             de la tarjeta dibujaba una segunda caja oscura. */
          <form
            noValidate
            className="rapago-auth-card"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            {brandHeader}

            <IonText>
              <h2 className="rapago-auth-title">¿Olvidaste tu contraseña?</h2>
            </IonText>

            <p className="rapago-auth-tagline">
              Escribe el correo asociado a tu cuenta RAPA GO. Te enviaremos un
              enlace seguro para cambiar tu contraseña.
            </p>

            {serverError && (
              <IonText color="danger">
                <p className="auth-error rapago-auth-error">{serverError}</p>
              </IonText>
            )}

            <IonItem
              className={`rapago-auth-field ${fieldError ? "ion-invalid" : ""}`}
              lines="none"
            >
              <IonLabel position="stacked">Correo electrónico</IonLabel>

              <IonInput
                type="email"
                value={email}
                placeholder="tu@correo.com"
                autocomplete="email"
                inputmode="email"
                disabled={loading}
                onIonInput={(event) => {
                  setEmail(String(event.detail.value ?? ""));
                  setFieldError("");
                  setServerError("");
                }}
              />

              {fieldError && <IonNote slot="error">{fieldError}</IonNote>}
            </IonItem>

            <IonButton
              expand="block"
              type="submit"
              disabled={loading}
              className="rapago-auth-btn-primary"
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                "Enviar enlace de recuperación"
              )}
            </IonButton>

            <IonButton
              expand="block"
              fill="clear"
              type="button"
              disabled={loading}
              onClick={() => history.replace(ROUTES.AUTH.LOGIN)}
              className="rapago-auth-btn-clear"
            >
              Volver al inicio de sesión
            </IonButton>
          </form>
        )}
      </IonContent>
    </IonPage>
  );
}
