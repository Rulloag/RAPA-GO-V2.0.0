import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  AppleSignIn,
  ErrorCode,
  SignInScope,
} from "@capawesome/capacitor-apple-sign-in";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { logoApple } from "ionicons/icons";
import { authService } from "./auth.service.js";
import { generateAppleNoncePair } from "./appleNonce.js";
import { useAuth } from "./useAuth.js";

interface AppleLinkButtonProps {
  linked: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AppleLinkButton({
  linked,
  onSuccess,
  onError,
}: AppleLinkButtonProps): JSX.Element | null {
  const { session, refreshSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const isAvailable =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  if (!isAvailable) return null;

  async function handleLink(): Promise<void> {
    if (linked || loading || !session?.accessToken) return;

    setLoading(true);
    try {
      const nonce = await generateAppleNoncePair();
      const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        nonce: nonce.hashed,
      });

      if (!result.idToken || !result.authorizationCode) {
        throw new Error("Apple no entregó credenciales completas.");
      }

      const response = await authService.linkApple(session.accessToken, {
        identityToken: result.idToken,
        authorizationCode: result.authorizationCode,
        nonce: nonce.raw,
        ...((result.givenName || result.familyName)
          ? {
              name: {
                ...(result.givenName
                  ? { givenName: result.givenName }
                  : {}),
                ...(result.familyName
                  ? { familyName: result.familyName }
                  : {}),
              },
            }
          : {}),
      });

      await refreshSession();
      onSuccess(response.message);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === ErrorCode.SignInCanceled) return;
      onError(
        error instanceof Error
          ? error.message
          : "No se pudo vincular Apple.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonButton
      expand="block"
      color={linked ? "success" : "dark"}
      disabled={linked || loading}
      onClick={() => void handleLink()}
      style={{ textTransform: "none", fontWeight: 850 }}
    >
      {loading ? (
        <IonSpinner slot="start" name="crescent" />
      ) : (
        <IonIcon slot="start" icon={logoApple} />
      )}
      {linked ? "Apple vinculado" : "Vincular Sign in with Apple"}
    </IonButton>
  );
}
