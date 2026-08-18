import {
  normalizeVehicleCategory,
  vehicleCategoryLabel,
  vehicleCategoryEmoji,
  type VehicleCategory,
} from "@rapa-go/shared";

export interface VehicleCategorySnapshotsProps {
  requestedVehicleCategory?: string | null;
  assignedVehicleCategory?: string | null;
  /** Legacy fields to try if requestedVehicleCategory is absent/invalid */
  fareVehicleCategory?: string | null;
  vehicleCategory?: string | null;
  vehicleType?: string | null;
  requestedVehicleType?: string | null;
  notes?: string | null;
  /** Ride status — used to determine pending vs missing historical */
  status?: string | null;
  /** Whether a driver was assigned (used to distinguish cancelled-before-assignment) */
  driverUserId?: string | null;
}

const POST_ASSIGNMENT_STATUSES = new Set([
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "completed",
]);

const PENDING_STATUSES = new Set([
  "scheduled",
  "requested",
]);

export function resolveRequestedDisplay(
  props: VehicleCategorySnapshotsProps,
): { category: VehicleCategory; label: string; emoji: string } | null {
  const cat =
    normalizeVehicleCategory(props.requestedVehicleCategory) ??
    normalizeVehicleCategory(props.fareVehicleCategory) ??
    normalizeVehicleCategory(props.vehicleCategory) ??
    normalizeVehicleCategory(props.vehicleType) ??
    normalizeVehicleCategory(props.requestedVehicleType) ??
    extractFromNotes(props.notes);

  if (!cat) return null;
  return { category: cat, label: vehicleCategoryLabel(cat), emoji: vehicleCategoryEmoji(cat) };
}

export function resolveAssignedDisplay(
  props: VehicleCategorySnapshotsProps,
): { label: string; emoji: string; pending: boolean } {
  const cat = normalizeVehicleCategory(props.assignedVehicleCategory);
  if (cat) {
    return { label: vehicleCategoryLabel(cat), emoji: vehicleCategoryEmoji(cat), pending: false };
  }

  const status = props.status ?? "";
  const hasDriver = Boolean(props.driverUserId);

  if (POST_ASSIGNMENT_STATUSES.has(status) || hasDriver) {
    return { label: "Sin información histórica", emoji: "❓", pending: false };
  }

  if (status === "cancelled") {
    return hasDriver
      ? { label: "Sin información histórica", emoji: "❓", pending: false }
      : { label: "No asignado", emoji: "—", pending: false };
  }

  if (PENDING_STATUSES.has(status)) {
    return { label: "Pendiente de asignación", emoji: "⏳", pending: true };
  }

  return { label: "Sin información", emoji: "—", pending: false };
}

function extractFromNotes(notes: string | null | undefined): VehicleCategory | null {
  if (!notes) return null;
  const patterns = [
    /Veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /Categor[ií]a de veh[ií]culo\s*:\s*([^\n.]+)/i,
  ];
  for (const re of patterns) {
    const m = notes.match(re);
    if (m) {
      const cat = normalizeVehicleCategory(m[1]?.trim());
      if (cat) return cat;
    }
  }
  return null;
}

export function VehicleCategorySnapshots(props: VehicleCategorySnapshotsProps): JSX.Element {
  const requested = resolveRequestedDisplay(props);
  const assigned = resolveAssignedDisplay(props);

  const showMismatch =
    requested &&
    !assigned.pending &&
    assigned.label !== "Sin información histórica" &&
    requested.label !== assigned.label;

  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 12,
        background: "var(--rp-surface-soft, #f8f9fa)",
        fontSize: ".76rem",
        lineHeight: 1.4,
      }}
    >
      <div>
        <span style={{ fontWeight: 800, color: "var(--rp-muted, #64748b)" }}>
          Categoría solicitada:
        </span>{" "}
        {requested
          ? `${requested.emoji} ${requested.label}`
          : "No registrada"}
      </div>
      <div style={{ marginTop: 3 }}>
        <span style={{ fontWeight: 800, color: "var(--rp-muted, #64748b)" }}>
          Vehículo asignado:
        </span>{" "}
        {`${assigned.emoji} ${assigned.label}`}
      </div>
      {showMismatch && (
        <div
          style={{
            marginTop: 4,
            fontSize: ".72rem",
            color: "var(--rp-muted, #64748b)",
            fontStyle: "italic",
          }}
        >
          El vehículo asignado es de una categoría diferente a la solicitada.
        </div>
      )}
    </div>
  );
}
