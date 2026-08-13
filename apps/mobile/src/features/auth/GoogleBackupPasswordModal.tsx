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
} from "@ionic/react";
import {
  eyeOffOutline,
  eyeOutline,
  keyOutline,
  logoGoogle,
  shieldCheckmarkOutline,
} from "ionicons/icons";

interface GoogleBackupPasswordModalProps {
  isOpen: boolean;
  loading: boolean;
  displayEmail: string;
  error?: string;
  onConfirm: (newPassword: string, confirmPassword: string) => void;
  onSkip: () => void;
}

export function GoogleBackupPasswordModal({
  isOpen,
  loading,
  displayEmail,
  error,
  onConfirm,
  onSkip,
}: GoogleBackupPasswordModalProps): JSX.Element {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setLocalError("");
  }, [isOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (newPassword.length < 8 || newPassword.length > 128) {
      setLocalError("La contraseña debe tener entre 8 y 128 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }

    setLocalError("");
    onConfirm(newPassword, confirmPassword);
  }

  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={false}
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
            padding: "28px 18px 30px",
            color: "#17130d",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 14px",
              background: "#ffffff",
              border: "1px solid rgba(17,17,17,.10)",
              boxShadow: "0 12px 28px rgba(0,0,0,.10)",
            }}
          >
            <IonIcon
              icon={logoGoogle}
              aria-hidden="true"
              style={{ fontSize: 32 }}
            />
          </div>

          <IonText>
            <h2
              style={{
                margin: 0,
                textAlign: "center",
                color: "#17130d",
                fontSize: "1.4rem",
                fontWeight: 950,
              }}
            >
              Google ya está conectado
            </h2>
          </IonText>

          <p
            style={{
              margin: "10px 0 0",
              textAlign: "center",
              color: "#5f5140",
              fontSize: ".86rem",
              lineHeight: 1.48,
              fontWeight: 750,
            }}
          >
            Crea una contraseña de respaldo de RAPA GO. Podrás seguir entrando
            con Google y también usar correo + contraseña si lo necesitas.
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
              style={{ verticalAlign: "-2px", marginRight: 6, fontSize: "1rem" }}
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
              <IonIcon icon={keyOutline} slot="start" aria-hidden="true" />
              <IonLabel position="stacked">Nueva contraseña</IonLabel>
              <IonInput
                type={showPassword ? "text" : "password"}
                value={newPassword}
                minlength={8}
                maxlength={128}
                autocomplete="new-password"
                placeholder="Mínimo 8 caracteres"
                disabled={loading}
                onIonInput={(event) => {
                  setNewPassword(String(event.detail.value ?? ""));
                  setLocalError("");
                }}
              />
              <IonButton
                slot="end"
                type="button"
                fill="clear"
                disabled={loading}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <IonIcon
                  slot="icon-only"
                  icon={showPassword ? eyeOffOutline : eyeOutline}
                />
              </IonButton>
            </IonItem>

            <IonItem
              lines="none"
              style={
                {
                  "--background": "#ffffff",
                  "--border-radius": "16px",
                  "--padding-start": "14px",
                  marginTop: 12,
                  border: "1.5px solid rgba(210,164,58,.42)",
                  borderRadius: 16,
                  overflow: "hidden",
                } as CSSProperties
              }
            >
              <IonIcon icon={keyOutline} slot="start" aria-hidden="true" />
              <IonLabel position="stacked">Repetir contraseña</IonLabel>
              <IonInput
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                minlength={8}
                maxlength={128}
                autocomplete="new-password"
                placeholder="Repite la contraseña"
                disabled={loading}
                onIonInput={(event) => {
                  setConfirmPassword(String(event.detail.value ?? ""));
                  setLocalError("");
                }}
              />
            </IonItem>

            {(localError || error) && (
              <IonNote
                color="danger"
                style={{ display: "block", margin: "9px 4px 0", fontWeight: 800 }}
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
              {loading ? <IonSpinner name="dots" /> : "Guardar contraseña y entrar"}
            </IonButton>

            <IonButton
              expand="block"
              type="button"
              fill="clear"
              color="medium"
              disabled={loading}
              onClick={onSkip}
              style={{ marginTop: 6, fontWeight: 850 }}
            >
              Ahora no
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
            La contraseña es propia de RAPA GO. Google nunca comparte tu
            contraseña de Google con la aplicación. Si eliges Ahora no, podrás
            crearla después desde Perfil → Seguridad.
          </p>
        </div>
      </IonContent>
    </IonModal>
  );
}
