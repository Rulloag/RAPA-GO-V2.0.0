import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import { checkmarkCircleOutline, constructOutline } from "ionicons/icons";
import type { UserRole } from "../navigation/routeConfig";

interface ModulePlaceholderPageProps {
  title: string;
  role: UserRole | "public";
  plannedFeatures: string[];
}

const ROLE_LABELS: Record<UserRole | "public", string> = {
  passenger: "Pasajero",
  driver: "Conductor",
  guide: "Guía Turístico",
  rental: "Empresa de Arriendo",
  admin: "Administrador",
  public: "Público",
};

const ROLE_COLORS: Record<UserRole | "public", string> = {
  passenger: "primary",
  driver: "success",
  guide: "warning",
  rental: "tertiary",
  admin: "danger",
  public: "medium",
};

export function ModulePlaceholderPage({
  title,
  role,
  plannedFeatures,
}: ModulePlaceholderPageProps): JSX.Element {
  const color = ROLE_COLORS[role];
  const roleLabel = ROLE_LABELS[role];

  return (
    <div style={{ padding: "1.5rem", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <IonIcon icon={constructOutline} style={{ fontSize: "2rem", color: `var(--ion-color-${color})` }} />
        <IonText>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>{title}</h2>
        </IonText>
      </div>

      <IonText color={color}>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Módulo: {roleLabel}
        </p>
      </IonText>

      <IonText color="medium">
        <p style={{ margin: "0 0 1rem", fontSize: "0.95rem" }}>
          Este módulo está en construcción. A continuación se listan las funcionalidades planificadas:
        </p>
      </IonText>

      <IonList inset style={{ marginBottom: "1.5rem" }}>
        {plannedFeatures.map((feature) => (
          <IonItem key={feature} lines="none" style={{ "--min-height": "2.5rem" }}>
            <IonIcon slot="start" icon={checkmarkCircleOutline} color="medium" />
            <IonLabel style={{ fontSize: "0.9rem" }}>{feature}</IonLabel>
          </IonItem>
        ))}
      </IonList>

      <IonText color="medium">
        <p style={{ margin: 0, fontSize: "0.8rem", fontStyle: "italic" }}>
          Fase de desarrollo: Esqueleto de navegación — Sin funcionalidad real aún.
        </p>
      </IonText>
    </div>
  );
}
