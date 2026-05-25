import { IonIcon, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import { timeOutline, constructOutline } from "ionicons/icons";
import type { UserRole } from "../navigation/routeConfig";

interface ModulePlaceholderPageProps {
  title: string;
  role: UserRole | "public";
  plannedFeatures: string[];
}

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

  return (
    <div style={{ padding: "1.5rem", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: `var(--ion-color-${color}-tint)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <IonIcon icon={constructOutline} style={{ fontSize: "24px", color: `var(--ion-color-${color})` }} />
        </div>
        <IonText>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{title}</h2>
        </IonText>
      </div>

      <IonText color="medium">
        <p style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
          Esta sección estará disponible en una próxima actualización. Funcionalidades previstas:
        </p>
      </IonText>

      <IonList inset style={{ marginBottom: "1.5rem" }}>
        {plannedFeatures.map((feature) => (
          <IonItem key={feature} lines="none" style={{ "--min-height": "2.5rem" }}>
            <IonIcon slot="start" icon={timeOutline} color="medium" />
            <IonLabel style={{ fontSize: "0.9rem", color: "var(--ion-color-medium)" }}>{feature}</IonLabel>
          </IonItem>
        ))}
      </IonList>
    </div>
  );
}
