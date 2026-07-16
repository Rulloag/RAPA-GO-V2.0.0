import { useState, type CSSProperties, type FormEvent } from "react";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";

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

export function ForgotPasswordPage(): JSX.Element {
  const history = useHistory();

  const [email, setEmail] = useState("");
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
      "linear-gradient(180deg, rgba(20,16,12,.72), rgba(20,16,12,.88)), url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed",
  } as CSSProperties;

  const cardStyle: CSSProperties = {
    width: "min(92vw, 470px)",
    margin: "42px auto 24px",
    padding: "24px",
    borderRadius: 30,
    background:
      "linear-gradient(180deg, rgba(26,26,25,.97), rgba(15,15,15,.99))",
    border: "1px solid rgba(214,166,64,.36)",
    boxShadow:
      "0 24px 70px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.08)",
    color: "#F6F2EC",
  };

  const inputShellStyle = {
    "--background": "rgba(255,255,255,.065)",
    "--color": "#F6F2EC",
    "--border-color": "rgba(214,166,64,.30)",
    "--highlight-color-focused": "#D6A640",
    "--padding-start": "16px",
    "--inner-padding-end": "16px",
    border: "1px solid rgba(214,166,64,.30)",
    borderRadius: "18px",
    overflow: "hidden",
    marginTop: "18px",
  } as CSSProperties;

  const primaryButtonStyle = {
    "--border-radius": "18px",
    "--background":
      "linear-gradient(135deg,#F8D879 0%,#D6A640 48%,#B84F2E 100%)",
    "--background-activated":
      "linear-gradient(135deg,#C89B3C,#B84F2E)",
    "--box-shadow": "0 16px 32px rgba(214,166,64,.32)",
    "--color": "#111",
    height: "54px",
    fontWeight: 950,
    marginTop: "16px",
  } as CSSProperties;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar
          style={
            {
              "--background":
                "linear-gradient(135deg,#111 0%,#5A241A 56%,#C89B3C 130%)",
              "--color": "#fff",
              "--min-height": "72px",
            } as CSSProperties
          }
        >
          <IonTitle style={{ fontWeight: 950 }}>
            Recuperar contraseña
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={pageStyle}>
        <div style={cardStyle}>
          <div
            style={{
              width: 60,
              height: 60,
              display: "grid",
              placeItems: "center",
              borderRadius: 20,
              background:
                "linear-gradient(135deg,#F8D879,#C89B3C 48%,#8F3C24)",
              color: "#111",
              fontSize: "1.7rem",
              boxShadow: "0 12px 28px rgba(200,155,60,.30)",
              marginBottom: 16,
            }}
          >
            🔐
          </div>

          {sent ? (
            <>
              <IonText>
                <h2
                  style={{
                    color: "#F8D879",
                    margin: "0 0 10px",
                    fontWeight: 950,
                  }}
                >
                  Revisa tu correo
                </h2>
              </IonText>

              <p
                style={{
                  color: "rgba(246,242,236,.78)",
                  lineHeight: 1.5,
                  fontWeight: 750,
                }}
              >
                Si el correo está registrado, recibirás un enlace para crear
                una contraseña nueva. El enlace tendrá una duración limitada.
              </p>

              <IonButton
                expand="block"
                type="button"
                style={primaryButtonStyle}
                onClick={() => history.replace("/auth/login")}
              >
                Volver al inicio de sesión
              </IonButton>
            </>
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
            >
              <IonText>
                <h2
                  style={{
                    color: "#F8D879",
                    margin: "0 0 8px",
                    fontWeight: 950,
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </h2>
              </IonText>

              <p
                style={{
                  color: "rgba(246,242,236,.75)",
                  lineHeight: 1.45,
                  margin: 0,
                  fontWeight: 730,
                }}
              >
                Escribe el correo asociado a tu cuenta RAPA GO. Te enviaremos
                un enlace seguro para cambiar tu contraseña.
              </p>

              {serverError && (
                <IonText color="danger">
                  <p
                    style={{
                      padding: "11px 12px",
                      borderRadius: 14,
                      margin: "16px 0 0",
                      fontWeight: 850,
                      background: "rgba(239,68,68,.13)",
                      border: "1px solid rgba(239,68,68,.30)",
                    }}
                  >
                    {serverError}
                  </p>
                </IonText>
              )}

              <IonItem
                className={fieldError ? "ion-invalid" : ""}
                style={inputShellStyle}
              >
                <IonLabel
                  position="stacked"
                  style={{ color: "#F8D879", fontWeight: 900 }}
                >
                  Correo electrónico
                </IonLabel>

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
                  style={
                    {
                      "--color": "#F6F2EC",
                      "--placeholder-color": "rgba(246,242,236,.52)",
                      "--placeholder-opacity": "1",
                      fontWeight: 850,
                    } as CSSProperties
                  }
                />

                {fieldError && (
                  <IonNote slot="error">{fieldError}</IonNote>
                )}
              </IonItem>

              <IonButton
                expand="block"
                type="submit"
                disabled={loading}
                style={primaryButtonStyle}
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
                onClick={() => history.replace("/auth/login")}
                style={
                  {
                    "--color": "#F8D879",
                    fontWeight: 900,
                    textTransform: "none",
                    marginTop: 8,
                  } as CSSProperties
                }
              >
                Volver al inicio de sesión
              </IonButton>
            </form>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
