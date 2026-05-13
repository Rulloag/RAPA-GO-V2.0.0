import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { logOutOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { useAuth } from "../features/auth";
import { ROUTES } from "../navigation/routes";
import { StatusBadge } from "./StatusBadge";
import type { UserRole } from "@rapa-go/shared";

const ROLE_LABEL: Record<UserRole, string> = {
  passenger:       "Pasajero",
  driver:          "Conductor",
  guide:           "Guía Turístico",
  rental_operator: "Operador de Arriendo",
  admin:           "Administrador",
};

const ROLE_COLOR: Record<UserRole, string> = {
  passenger:       "primary",
  driver:          "success",
  guide:           "warning",
  rental_operator: "tertiary",
  admin:           "danger",
};

interface HomeHeaderProps {
  title: string;
}

export function HomeHeader({ title }: HomeHeaderProps): JSX.Element {
  const { user, logout } = useAuth();
  const history = useHistory();

  async function handleLogout() {
    await logout();
    history.replace(ROUTES.WELCOME);
  }

  const role = user?.role;
  const color = role ? ROLE_COLOR[role] : "primary";

  return (
    <IonHeader>
      <IonToolbar color={color}>
        <IonTitle>{title}</IonTitle>
        <IonButtons slot="end">
          <IonButton onClick={() => void handleLogout()} title="Cerrar sesión">
            <IonIcon slot="icon-only" icon={logOutOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
      {user && (
        <IonToolbar color={color} style={{ "--min-height": "36px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "0 16px 6px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "var(--ion-color-contrast)", fontSize: "0.9rem", fontWeight: 500 }}>
              Hola, {user.name}
            </span>
            <StatusBadge
              label={role ? ROLE_LABEL[role] : ""}
              color="light"
            />
            {!user.isVerified && (
              <StatusBadge label="Sin verificar" color="warning" />
            )}
          </div>
        </IonToolbar>
      )}
    </IonHeader>
  );
}
