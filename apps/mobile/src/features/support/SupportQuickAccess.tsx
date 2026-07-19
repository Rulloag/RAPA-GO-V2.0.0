import { IonFab, IonFabButton, IonIcon } from "@ionic/react";
import { helpBuoyOutline } from "ionicons/icons";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/index.js";
import { ROUTES } from "../../navigation/routes.js";

export function SupportQuickAccess(): JSX.Element | null {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status !== "authenticated" || user?.role !== "driver") {
    return null;
  }

  if (location.pathname === ROUTES.SUPPORT.CENTER) {
    return null;
  }

  return (
    <IonFab
      vertical="bottom"
      horizontal="end"
      slot="fixed"
      style={{
        marginBottom: "150px",
        marginRight: "12px",
        zIndex: 1002,
      }}
    >
      <IonFabButton
        routerLink={ROUTES.SUPPORT.CENTER}
        color="warning"
        aria-label="Abrir centro de ayuda"
        title="Centro de ayuda"
        style={{
          width: "58px",
          height: "58px",
          "--box-shadow": "0 8px 22px rgba(0, 0, 0, 0.35)",
        }}
      >
        <IonIcon
          icon={helpBuoyOutline}
          style={{
            fontSize: "27px",
          }}
        />
      </IonFabButton>
    </IonFab>
  );
}