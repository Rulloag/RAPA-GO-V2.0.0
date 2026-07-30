import { IonIcon, IonText } from "@ionic/react";
import { carOutline, starOutline, star } from "ionicons/icons";
import { WhatsAppButton } from "./WhatsAppButton.js";

interface DriverInfoCardProps {
  name: string;
  photo?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
  vehicleYear?: number | null;
  phone?: string | null;
  waMessage?: string | null;
}

function StarRating({ value }: { value: number }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IonIcon
          key={n}
          icon={n <= Math.round(value) ? star : starOutline}
          style={{ fontSize: "0.9rem", color: "var(--ion-color-warning)" }}
        />
      ))}
    </div>
  );
}

export function DriverInfoCard({
  name,
  photo,
  rating,
  ratingCount,
  vehicleBrand,
  vehicleModel,
  vehicleColor,
  vehiclePlate,
  vehicleYear,
  phone,
  waMessage,
}: DriverInfoCardProps): JSX.Element {
  const initials = name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "C";

  return (
    <div style={{
      background: "var(--ion-color-light)",
      borderRadius: "14px",
      padding: "14px 16px",
      display: "flex",
      gap: "14px",
      alignItems: "flex-start",
    }}>
      {/* Avatar */}
      <div style={{
        width: "52px", height: "52px", borderRadius: "50%", flexShrink: 0,
        background: photo ? "transparent" : "var(--ion-color-primary-tint)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {photo
          ? <img src={photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--ion-color-primary)" }}>{initials}</span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ion-color-dark)" }}>{name}</div>
        {rating != null && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
            <StarRating value={rating} />
            <IonText color="medium">
              <span style={{ fontSize: "0.72rem" }}>
                {rating.toFixed(1)}{ratingCount != null ? ` (${ratingCount})` : ""}
              </span>
            </IonText>
          </div>
        )}
        {(vehicleBrand || vehicleModel || vehiclePlate) && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
            <IonIcon icon={carOutline} style={{ fontSize: "1rem", color: "var(--ion-color-medium)", flexShrink: 0 }} />
            <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
              {[vehicleBrand, vehicleModel].filter(Boolean).join(" ")}
              {vehicleYear ? ` (${vehicleYear})` : ""}
              {vehicleColor ? ` · ${vehicleColor}` : ""}
              {vehiclePlate ? ` · ` : ""}
              {vehiclePlate && <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{vehiclePlate}</span>}
            </div>
          </div>
        )}
        {phone && waMessage && (
          <div style={{ marginTop: "8px" }}>
            <WhatsAppButton phone={phone} message={waMessage} label="Contactar conductor" size="small" />
          </div>
        )}
      </div>
    </div>
  );
}
