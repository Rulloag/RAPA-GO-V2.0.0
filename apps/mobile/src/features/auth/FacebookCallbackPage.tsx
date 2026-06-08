import { IonContent, IonPage, IonSpinner, IonText } from "@ionic/react";
import { useEffect } from "react";
import { useHistory } from "react-router-dom";
import type { UserRole } from "@rapa-go/shared";
import { ROUTES } from "../../navigation/routes.js";
import { sessionStorageService } from "./sessionStorage.service.js";
import type { AuthSession } from "./auth.types.js";

const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin: ROUTES.ADMIN.HOME,
};

export function FacebookCallbackPage(): JSX.Element {
  const history = useHistory();

  useEffect(() => {
    async function finishFacebookLogin(): Promise<void> {
      const params = new URLSearchParams(window.location.search);

      const accessToken = params.get("accessToken");
      const expiresAt = params.get("expiresAt");
      const userId = params.get("userId");
      const email = params.get("email");
      const name = params.get("name");
      const role = params.get("role") as UserRole | null;
      const avatarUrl = params.get("avatarUrl") || null;
      const isVerified = params.get("isVerified") === "true";

      if (!accessToken || !expiresAt || !userId || !email || !name || !role) {
        history.replace(`${ROUTES.AUTH.LOGIN}?facebook=missing_session`);
        return;
      }

      const session: AuthSession = {
        accessToken,
        expiresAt,
        user: {
          id: userId,
          email,
          name,
          role,
          avatarUrl,
          isVerified,
        },
      };

      await sessionStorageService.saveSession(session);

      const home = ROLE_HOME[role] ?? ROUTES.PASSENGER.HOME;

      window.location.replace(home);
    }

    void finishFacebookLogin();
  }, [history]);

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <IonSpinner name="crescent" />
          <IonText>Iniciando sesión con Facebook...</IonText>
        </div>
      </IonContent>
    </IonPage>
  );
}