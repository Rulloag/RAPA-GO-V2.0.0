import type { CSSProperties } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
} from "@ionic/react";
import {
  checkmarkCircle,
  closeOutline,
  personOutline,
} from "ionicons/icons";
import type { PublicRole } from "./roles.js";

export interface AppleRoleSelectionModalProps {
  isOpen: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (role: PublicRole) => void;
}

/**
 * Sign in with Apple se utiliza solamente para cuentas de pasajero.
 * Conductores, guias y arriendos mantienen sus flujos normales fuera de Apple.
 */
export function AppleRoleSelectionModal({
  isOpen,
  loading,
  onCancel,
  onConfirm,
}: AppleRoleSelectionModalProps): JSX.Element {
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onCancel}
      backdropDismiss={!loading}
      style={
        {
          "--width": "min(94vw, 560px)",
          "--height": "min(78vh, 590px)",
          "--border-radius": "30px",
          "--box-shadow": "0 30px 90px rgba(45,31,12,.34)",
        } as CSSProperties
      }
    >
      <IonContent
        scrollY={true}
        style={
          {
            "--background":
              "linear-gradient(180deg,#FFFDF8 0%,#F8F0E3 58%,#EFE1CA 100%)",
            "--color": "#2E2418",
          } as CSSProperties
        }
      >
        <div
          style={{
            minHeight: "100%",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
              padding: "4px 2px 2px",
            }}
          >
            <div>
              <div
                style={{
                  color: "#9A6500",
                  fontSize: ".72rem",
                  fontWeight: 950,
                  letterSpacing: ".09em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Registro con Apple
              </div>

              <h2
                style={{
                  margin: 0,
                  color: "#2D2114",
                  fontSize: "clamp(1.45rem, 5vw, 2rem)",
                  lineHeight: 1.05,
                  fontWeight: 950,
                }}
              >
                Continuar como pasajero
              </h2>
            </div>

            <button
              type="button"
              aria-label="Cancelar registro con Apple"
              disabled={loading}
              onClick={onCancel}
              style={{
                width: 44,
                height: 44,
                flex: "0 0 44px",
                borderRadius: 15,
                border: "1px solid rgba(154,101,0,.32)",
                background: "rgba(255,255,255,.82)",
                color: "#704600",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 8px 22px rgba(74,48,13,.10)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <IonIcon icon={closeOutline} style={{ fontSize: 22 }} />
            </button>
          </div>

          <p
            style={{
              margin: 0,
              color: "#665644",
              fontSize: ".96rem",
              lineHeight: 1.45,
              fontWeight: 720,
            }}
          >
            El acceso con Apple está disponible únicamente para crear o
            ingresar a una cuenta de pasajero en Rapa Go.
          </p>

          <div
            aria-label="Tipo de cuenta Apple: pasajero"
            style={{ display: "grid", gap: 12 }}
          >
            <div
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "52px minmax(0,1fr) 30px",
                alignItems: "center",
                gap: 13,
                padding: "14px",
                borderRadius: 21,
                textAlign: "left",
                border: "2px solid rgba(34,197,94,.72)",
                background: "linear-gradient(135deg,#ECFDF3,#FFFFFF)",
                color: "#211A13",
                boxShadow: "0 14px 30px rgba(34,197,94,.16)",
              }}
            >
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 17,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg,#22C55E,#16A34A)",
                  color: "#fff",
                }}
              >
                <IonIcon icon={personOutline} style={{ fontSize: 25 }} />
              </span>

              <span style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: "1rem",
                    fontWeight: 950,
                    lineHeight: 1.2,
                  }}
                >
                  Pasajero
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    color: "#6D5E4C",
                    fontSize: ".78rem",
                    fontWeight: 720,
                    lineHeight: 1.3,
                  }}
                >
                  Solicitar viajes y acceder a los servicios para pasajeros.
                </span>
              </span>

              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: "#22C55E",
                  color: "#fff",
                }}
              >
                <IonIcon icon={checkmarkCircle} style={{ fontSize: 21 }} />
              </span>
            </div>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 4 }}>
            <IonButton
              expand="block"
              type="button"
              disabled={loading}
              onClick={() => onConfirm("passenger")}
              style={
                {
                  "--border-radius": "18px",
                  "--background":
                    "linear-gradient(135deg,#D7AA43 0%,#F1D68D 100%)",
                  "--background-activated":
                    "linear-gradient(135deg,#C89B3C,#E6C46F)",
                  "--box-shadow": "0 14px 30px rgba(200,155,60,.30)",
                  color: "#17120D",
                  minHeight: "56px",
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              {loading ? (
                <>
                  <IonSpinner name="crescent" style={{ marginRight: 8 }} />
                  Validando...
                </>
              ) : (
                "Continuar como pasajero"
              )}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              type="button"
              disabled={loading}
              onClick={onCancel}
              style={
                {
                  "--border-radius": "18px",
                  "--border-color": "rgba(64,45,24,.46)",
                  "--color": "#2E2418",
                  minHeight: "50px",
                  marginTop: "10px",
                  fontWeight: 900,
                } as CSSProperties
              }
            >
              Volver
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
