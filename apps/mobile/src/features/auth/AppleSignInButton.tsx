import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { logoApple } from "ionicons/icons";

export interface AppleSignInButtonProps {
  isAvailable: boolean;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function AppleSignInButton({
  isAvailable,
  loading,
  disabled,
  onPress,
}: AppleSignInButtonProps): JSX.Element | null {
  if (!isAvailable) return null;

  return (
    <IonButton
      expand="block"
      color="dark"
      type="button"
      disabled={disabled || loading}
      onClick={onPress}
      aria-label="Sign in with Apple"
      style={{
        "--border-radius": "14px",
        "--background": "#000",
        "--color": "#fff",
        minHeight: 52,
        marginTop: 10,
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
  );
}
