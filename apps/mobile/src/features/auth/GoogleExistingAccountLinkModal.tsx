import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSpinner,
  IonText,
  IonToolbar,
} from "@ionic/react";
import {
  eyeOffOutline,
  eyeOutline,
  logoGoogle,
  shieldCheckmarkOutline,
} from "ionicons/icons";

interface GoogleExistingAccountLinkModalProps {
  isOpen: boolean;
  loading: boolean;
  displayEmail: string;
  error?: string;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}

export function GoogleExistingAccountLinkModal({
  isOpen,
  loading,
  displayEmail,
  error,
  onCancel,
  onConfirm,
}: GoogleExistingAccountLinkModalProps): JSX.Element {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPassword("");
    setShowPassword(false);
    setLocalError("");
  }, [isOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (password.length < 8) {
      setLocalError(
        "Ingresa la contraseña actual de tu cuenta RAPA GO.",
      );
      return;
    }

    setLocalError("");
    onConfirm(password);
  }

  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={!loading}
      onDidDismiss={() => {
        if (!loading) onCancel();
      }}
    >
      <IonContent
        style={
          {
            "--background":
              "linear-gradient(180deg,#fffaf0 0%,#f6ead0 100%)",
          } as CSSProperties
        }
      >
        <div
          style={{
            width: "min(100%, 520px)",
            margin: "0 auto",
            padding: "24px 18px 28px",
            color: "#17130d",
          }}
        >
          <IonToolbar
            style={
              {
                "--background": "transparent",
                "--border-width": "0",
                padding: 0,
              } as CSSProperties
            }
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
                background: "#ffffff",
                border: "1px solid rgba(17,17,17,.10)",
                boxShadow: "0 12px 28px rgba(0,0,0,.10)",
              }}
            >
              <IonIcon
                icon={logoGoogle}
                aria-hidden="true"
                style={{ fontSize: 30 }}
              />
            </div>
          </IonToolbar>

          <IonText>
            <h2
              style={{
                margin: "0",
                textAlign: "center",
                color: "#17130d",
                fontSize: "1.35rem",
                fontWeight: 950,
              }}
            >
              Vincular Google a tu cuenta
            </h2>
          </IonText>

          <p
            style={{
              margin: "10px 0 0",
              textAlign: "center",
              color: "#5f5140",
              fontSize: ".86rem",
              lineHeight: 1.45,
              fontWeight: 750,
            }}
          >
            Encontramos una cuenta RAPA GO existente con este correo.
            Confirma tu contraseña una sola vez para que Google y
            correo + contraseña entren al mismo perfil.
          </p>

          <div
            style={{
              margin: "16px 0",
              padding: "11px 12px",
              borderRadius: 14,
              background: "rgba(210,164,58,.13)",
              border: "1px solid rgba(210,164,58,.34)",
              color: "#5b3b0b",
              fontSize: ".8rem",
              lineHeight: 1.35,
              fontWeight: 850,
            }}
          >
            <IonIcon
              icon={shieldCheckmarkOutline}
              aria-hidden="true"
              style={{
                verticalAlign: "-2px",
                marginRight: 6,
                fontSize: "1rem",
              }}
            />
            {displayEmail || "Correo verificado por Google"}
          </div>

          <form onSubmit={handleSubmit}>
            <IonItem
              lines="none"
              style={
                {
                  "--background": "#ffffff",
                  "--border-radius": "16px",
                  "--padding-start": "14px",
                  "--inner-padding-end": "8px",
                  border: "1.5px solid rgba(210,164,58,.42)",
                  borderRadius: 16,
                  overflow: "hidden",
                } as CSSProperties
              }
            >
              <IonLabel position="stacked">
                Contraseña actual de RAPA GO
              </IonLabel>
              <IonInput
                type={showPassword ? "text" : "password"}
                value={password}
                autocomplete="current-password"
                placeholder="Tu contraseña"
                disabled={loading}
                onIonInput={(event) => {
                  setPassword(String(event.detail.value ?? ""));
                  setLocalError("");
                }}
              />
              <IonButton
                slot="end"
                type="button"
                fill="clear"
                disabled={loading}
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                <IonIcon
                  slot="icon-only"
                  icon={
                    showPassword
                      ? eyeOffOutline
                      : eyeOutline
                  }
                />
              </IonButton>
            </IonItem>

            {(localError || error) && (
              <IonNote
                color="danger"
                style={{
                  display: "block",
                  margin: "9px 4px 0",
                  fontWeight: 800,
                }}
              >
                {localError || error}
              </IonNote>
            )}

            <IonButton
              expand="block"
              type="submit"
              disabled={loading}
              style={
                {
                  marginTop: 16,
                  "--background":
                    "linear-gradient(135deg,#F8D879 0%,#D2A43A 100%)",
                  "--color": "#111111",
                  "--border-radius": "16px",
                  height: "48px",
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              {loading ? (
                <IonSpinner name="dots" />
              ) : (
                "Vincular Google y entrar"
              )}
            </IonButton>

            <IonButton
              expand="block"
              type="button"
              fill="clear"
              color="medium"
              disabled={loading}
              onClick={onCancel}
              style={{ marginTop: 6, fontWeight: 850 }}
            >
              Cancelar
            </IonButton>
          </form>

          <p
            style={{
              margin: "12px 4px 0",
              color: "#766756",
              fontSize: ".72rem",
              lineHeight: 1.35,
              textAlign: "center",
            }}
          >
            RAPA GO no cambia tu contraseña ni crea una segunda
            cuenta. Solo vincula la identidad verificada de Google
            al mismo usuario existente.
          </p>
        </div>
      </IonContent>
    </IonModal>
  );
}
