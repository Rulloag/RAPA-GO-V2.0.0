import { IonCard, IonCardContent } from "@ionic/react";

interface DriverSummaryCardProps {
  driverName:          string | null;
  driverRatingAverage: number | null;
  driverRatingCount:   number;
  status:              string;
}

const STATUS_CONTEXT: Record<string, string> = {
  accepted:        "Tu conductor fue asignado y pronto irá en camino.",
  driver_en_route: "Tu conductor va en camino al punto de origen.",
  driver_arrived:  "Tu conductor llegó al punto de origen.",
  in_progress:     "Viaje en curso hacia tu destino.",
  completed:       "Viaje finalizado.",
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function DriverSummaryCard({
  driverName,
  driverRatingAverage,
  driverRatingCount,
  status,
}: DriverSummaryCardProps): JSX.Element {
  const initials    = getInitials(driverName);
  const contextText = STATUS_CONTEXT[status] ?? "";

  const ratingText =
    driverRatingAverage != null
      ? `★ ${driverRatingAverage.toFixed(1)} (${driverRatingCount} calificacion${driverRatingCount !== 1 ? "es" : ""})`
      : "Sin calificaciones aún";

  return (
    <IonCard style={{ margin: "12px 0 0", borderRadius: "12px" }}>
      <IonCardContent style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Avatar circular con iniciales */}
          <div
            style={{
              width:           "52px",
              height:          "52px",
              borderRadius:    "50%",
              background:      "#1a73e8",
              color:           "#ffffff",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              fontSize:        "1.25rem",
              fontWeight:      700,
              flexShrink:      0,
              letterSpacing:   "0.03em",
            }}
          >
            {initials}
          </div>

          {/* Info del conductor */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {driverName ?? "Conductor"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#f4c430", marginBottom: "4px" }}>
              {ratingText}
            </div>
            {contextText && (
              <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", lineHeight: "1.35" }}>
                {contextText}
              </div>
            )}
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
}
