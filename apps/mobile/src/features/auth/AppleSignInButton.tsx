import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { logoApple } from "ionicons/icons";

export interface AppleSignInButtonProps {
  /** True for native iOS and for supported web browsers. */
  isAvailable: boolean;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * Official-style "Sign in with Apple" button.
 *
 * Rendered when a complete Apple flow is available:
 * native AuthenticationServices on iOS, or the Services ID web flow in a
 * browser. Native Android keeps the button hidden.
 *
 * Visual: solid black button, official "Sign in with Apple" logo + the
 * official English label text (Apple's guidelines do not provide an
 * approved Spanish translation for the button label itself — inventing one
 * would violate their brand guidelines, unlike the rest of this app's UI).
 *
 * Takes its state as props (rather than calling useAppleSignIn() itself) so
 * a parent screen can share one hook instance between this button and the
 * role-selection modal it may need to show afterward.
 */
export function AppleSignInButton({ isAvailable, loading, disabled, onPress }: AppleSignInButtonProps): JSX.Element | null {
  if (!isAvailable) return null;

  return (
    <IonButton
      expand="block"
      color="dark"
      disabled={disabled || loading}
      onClick={onPress}
      style={{ "--border-radius": "8px", marginTop: "0.5rem", minHeight: "44px" }}
      aria-label="Sign in with Apple"
      data-testid="apple-sign-in-button"
    >
      {loading ? <IonSpinner slot="start" name="crescent" /> : <IonIcon slot="start" icon={logoApple} />}
      Sign in with Apple
    </IonButton>
  );
}
