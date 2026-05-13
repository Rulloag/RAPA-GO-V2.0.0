import { IonCard, IonCardContent, IonIcon, IonRippleEffect } from "@ionic/react";
import { useHistory } from "react-router-dom";

interface ActionCardProps {
  icon: string;
  title: string;
  subtitle?: string;
  route: string;
  color?: string;
}

export function ActionCard({
  icon,
  title,
  subtitle,
  route,
  color = "primary",
}: ActionCardProps): JSX.Element {
  const history = useHistory();

  return (
    <IonCard
      className="ion-activatable"
      style={{ cursor: "pointer", margin: "0", borderRadius: "12px" }}
      onClick={() => history.push(route)}
    >
      <IonRippleEffect />
      <IonCardContent
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "20px 12px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: `var(--ion-color-${color})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IonIcon
            icon={icon}
            style={{
              fontSize: "1.6rem",
              color: `var(--ion-color-${color}-contrast)`,
            }}
          />
        </div>
        <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", lineHeight: 1.3 }}>
            {subtitle}
          </span>
        )}
      </IonCardContent>
    </IonCard>
  );
}
