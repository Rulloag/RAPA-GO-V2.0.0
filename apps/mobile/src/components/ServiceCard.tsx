import { IonIcon, IonRippleEffect } from "@ionic/react";

interface ServiceCardProps {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}

export function ServiceCard({ icon, title, subtitle, color, onClick }: ServiceCardProps): JSX.Element {
  return (
    <div
      className="ion-activatable"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "16px 8px 14px",
        background: "var(--ion-card-background, #fff)",
        borderRadius: "16px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        cursor: "pointer",
        minWidth: "80px",
        textAlign: "center",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <IonRippleEffect />
      <div style={{
        width: "52px",
        height: "52px",
        borderRadius: "14px",
        background: `var(--ion-color-${color})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <IonIcon icon={icon} style={{ fontSize: "1.5rem", color: `var(--ion-color-${color}-contrast)` }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--ion-text-color)", lineHeight: 1.2 }}>{title}</div>
      <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", lineHeight: 1.3 }}>{subtitle}</div>
    </div>
  );
}
