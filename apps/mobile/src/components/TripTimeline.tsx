import { IonIcon } from "@ionic/react";
import { checkmarkCircle, ellipseOutline, timeOutline } from "ionicons/icons";

interface TimelineStep {
  status: string;
  label: string;
  time?: string | null;
  completed: boolean;
  active?: boolean;
}

interface TripTimelineProps {
  steps: TimelineStep[];
}

export function TripTimeline({ steps }: TripTimelineProps): JSX.Element {
  return (
    <div style={{ padding: "4px 0" }}>
      {steps.map((step, i) => (
        <div key={step.status} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          {/* Icon column */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24px", flexShrink: 0 }}>
            <IonIcon
              icon={step.completed ? checkmarkCircle : step.active ? timeOutline : ellipseOutline}
              style={{
                fontSize: "1.3rem",
                color: step.completed
                  ? "var(--ion-color-success)"
                  : step.active
                  ? "var(--ion-color-primary)"
                  : "var(--ion-color-medium-tint)",
              }}
            />
            {i < steps.length - 1 && (
              <div style={{
                width: "2px",
                flex: 1,
                minHeight: "20px",
                background: step.completed ? "var(--ion-color-success-tint)" : "var(--ion-color-light-shade)",
                margin: "2px 0",
              }} />
            )}
          </div>
          {/* Text column */}
          <div style={{ paddingBottom: i < steps.length - 1 ? "12px" : 0 }}>
            <div style={{
              fontSize: "0.85rem",
              fontWeight: step.active ? 700 : 500,
              color: step.completed || step.active ? "var(--ion-text-color)" : "var(--ion-color-medium)",
            }}>
              {step.label}
            </div>
            {step.time && (
              <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                {new Date(step.time).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
