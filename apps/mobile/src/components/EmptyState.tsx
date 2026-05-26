import { IonButton, IonIcon, IonText } from "@ionic/react";

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps): JSX.Element {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      gap: "12px",
      textAlign: "center",
    }}>
      <IonIcon icon={icon} style={{ fontSize: "4rem", color: "var(--ion-color-medium-tint)" }} />
      <IonText>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ion-color-dark)" }}>{title}</h3>
      </IonText>
      {subtitle && (
        <IonText color="medium">
          <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5 }}>{subtitle}</p>
        </IonText>
      )}
      {actionLabel && onAction && (
        <IonButton onClick={onAction} style={{ marginTop: "8px" }}>
          {actionLabel}
        </IonButton>
      )}
    </div>
  );
}
