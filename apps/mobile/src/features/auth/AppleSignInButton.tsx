import { IonButton, IonIcon, IonNote, IonSpinner } from "@ionic/react";
import { logoApple } from "ionicons/icons";

export interface AppleSignInButtonProps {
  isAvailable: boolean;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * The Apple option stays visible on every login screen so reviewers and users
 * can confirm that RAPA GO supports Apple. It is only enabled inside the native
 * iOS app; browsers show an explanatory message when it is pressed.
 */
export function AppleSignInButton({
  isAvailable,
  loading,
  disabled,
  onPress,
}: AppleSignInButtonProps): JSX.Element {
  return (
    <div style={{ marginTop: 10 }}>
      <IonButton
        expand="block"
        color="dark"
        type="button"
        disabled={disabled || loading}
        onClick={onPress}
        aria-label="Continuar con Apple"
        style={{
          "--border-radius": "14px",
          "--background": "#000",
          "--color": "#fff",
          minHeight: 52,
          margin: 0,
          fontWeight: 900,
          textTransform: "none",
        }}
      >
        {loading ? (
          <IonSpinner slot="start" name="crescent" />
        ) : (
          <IonIcon slot="start" icon={logoApple} />
        )}
        Continuar con Apple
      </IonButton>

      {!isAvailable && (
        <IonNote
          style={{
            display: "block",
            margin: "7px 4px 0",
            color: "rgba(246,242,236,.72)",
            fontSize: ".76rem",
            lineHeight: 1.35,
            textAlign: "center",
          }}
        >
          Disponible para iniciar sesión dentro de la aplicación RAPA GO en iPhone.
        </IonNote>
      )}
    </div>
  );
}
