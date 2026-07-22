import {
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
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
import { useHistory, useLocation } from "react-router-dom";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "https://api.rapago.cl"
).replace(/\/$/, "");

export function ResetPasswordPage(): JSX.Element {
  const history = useHistory();
  const location = useLocation();

  const token = useMemo(() => {
    return new URLSearchParams(location.search).get("token")?.trim() ?? "";
  }, [location.search]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setFieldError("");
    setServerError("");

    if (!token) {
      setServerError(
        "El enlace no contiene un token válido. Solicita uno nuevo.",
      );
      return;
    }

    if (newPassword.length < 8) {
      setFieldError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFieldError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/password/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      if (response.status === 404) {
        throw new Error(
          "El servidor todavía no tiene activado el cambio automático de contraseña.",
        );
      }

      if (!response.ok) {
        let message =
          "El enlace venció o ya fue utilizado. Solicita uno nuevo.";

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

      setUpdated(true);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "No fue posible cambiar la contraseña.",
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
    marginTop: "12px",
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
            Nueva contraseña
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
            🔑
          </div>

          {updated ? (
            <>
              <IonText>
                <h2
                  style={{
                    color: "#F8D879",
                    margin: "0 0 10px",
                    fontWeight: 950,
                  }}
                >
                  Contraseña actualizada
                </h2>
              </IonText>

              <p
                style={{
                  color: "rgba(246,242,236,.78)",
                  lineHeight: 1.5,
                  fontWeight: 750,
                }}
              >
                Tu contraseña fue cambiada correctamente. Inicia sesión
                nuevamente con tu nueva contraseña.
              </p>

              <IonButton
                expand="block"
                type="button"
                style={primaryButtonStyle}
                onClick={() => history.replace("/auth/login")}
              >
                Ir al inicio de sesión
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
                  Crea una contraseña nueva
                </h2>
              </IonText>

              <p
                style={{
                  color: "rgba(246,242,236,.75)",
                  lineHeight: 1.45,
                  margin: "0 0 16px",
                  fontWeight: 730,
                }}
              >
                Utiliza al menos 8 caracteres. El enlace podrá usarse una sola
                vez.
              </p>

              {serverError && (
                <IonText color="danger">
                  <p
                    style={{
                      padding: "11px 12px",
                      borderRadius: 14,
                      margin: "0 0 12px",
                      fontWeight: 850,
                      background: "rgba(239,68,68,.13)",
                      border: "1px solid rgba(239,68,68,.30)",
                    }}
                  >
                    {serverError}
                  </p>
                </IonText>
              )}

              <IonItem style={inputShellStyle}>
                <IonLabel
                  position="stacked"
                  style={{ color: "#F8D879", fontWeight: 900 }}
                >
                  Nueva contraseña
                </IonLabel>

                <IonInput
                  type="password"
                  value={newPassword}
                  autocomplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  disabled={loading}
                  onIonInput={(event) => {
                    setNewPassword(String(event.detail.value ?? ""));
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
              </IonItem>

              <IonItem
                className={fieldError ? "ion-invalid" : ""}
                style={inputShellStyle}
              >
                <IonLabel
                  position="stacked"
                  style={{ color: "#F8D879", fontWeight: 900 }}
                >
                  Confirmar contraseña
                </IonLabel>

                <IonInput
                  type="password"
                  value={confirmPassword}
                  autocomplete="new-password"
                  placeholder="Repite la contraseña"
                  disabled={loading}
                  onIonInput={(event) => {
                    setConfirmPassword(String(event.detail.value ?? ""));
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
                  "Cambiar contraseña"
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
