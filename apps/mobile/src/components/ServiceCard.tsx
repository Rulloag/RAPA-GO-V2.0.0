import { IonIcon, IonRippleEffect } from "@ionic/react";

interface ServiceCardProps {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}

export function ServiceCard({
  icon,
  title,
  subtitle,
  color,
  onClick,
}: ServiceCardProps): JSX.Element {
  return (
    <div
      className="ion-activatable"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        padding: "18px 10px 16px",
        background: "#ffffff",
        borderRadius: "18px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
        cursor: "pointer",
        minWidth: "90px",
        textAlign: "center",
        overflow: "hidden",
        userSelect: "none",
        transition: "all .25s ease",
      }}
    >
      <IonRippleEffect />

      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: `var(--ion-color-${color})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
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

      <div
        style={{
          fontWeight: 800,
          fontSize: "0.95rem",
          color: "#111827",
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "0.78rem",
          color: "#4b5563",
          lineHeight: 1.35,
          fontWeight: 500,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}