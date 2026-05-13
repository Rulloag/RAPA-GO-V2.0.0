import { IonBadge } from "@ionic/react";

interface StatusBadgeProps {
  label: string;
  color?: string;
}

export function StatusBadge({ label, color = "medium" }: StatusBadgeProps): JSX.Element {
  return (
    <IonBadge color={color} style={{ fontSize: "0.7rem", fontWeight: 500 }}>
      {label}
    </IonBadge>
  );
}
