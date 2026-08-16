/**
 * Categorías de vehículo RAPA GO.
 *
 * Regla de negocio: informan y advierten, NUNCA restringen visibilidad
 * ni bloquean accept en backend. Usar `needsVehicleCategoryConfirmation`
 * solo en UI para el modal previo a aceptar.
 */

export const VEHICLE_CATEGORIES = [
  "standard",
  "xl",
  "extra_luggage",
] as const;

export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

/** Alias legado del cliente móvil (`luggage` ≡ `extra_luggage`). */
export type LegacyVehicleCategoryAlias = "luggage";

export type VehicleCategoryInput =
  | VehicleCategory
  | LegacyVehicleCategoryAlias
  | string
  | null
  | undefined;

export const VEHICLE_CATEGORY_CONFIG: Record<
  VehicleCategory,
  {
    label: string;
    shortLabel: string;
    emoji: string;
    listHint: string | null;
  }
> = {
  standard: {
    label: "Estándar",
    shortLabel: "Estándar",
    emoji: "🚗",
    listHint: null,
  },
  xl: {
    label: "XL",
    shortLabel: "XL",
    emoji: "🚐",
    listHint: "Viaje solicitado como XL",
  },
  extra_luggage: {
    label: "Extra Maleta",
    shortLabel: "Extra Maleta",
    emoji: "🧳",
    listHint: "Requiere espacio adicional para equipaje",
  },
};

export function isVehicleCategory(value: unknown): value is VehicleCategory {
  return (
    value === "standard" || value === "xl" || value === "extra_luggage"
  );
}

/**
 * Normaliza cualquier etiqueta/alias (incl. `luggage`, textos en notes)
 * a la categoría canónica. Devuelve null si no reconoce.
 */
export function normalizeVehicleCategory(
  value: VehicleCategoryInput,
): VehicleCategory | null {
  if (value == null) return null;
  const raw = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (!raw) return null;

  if (
    raw === "extra_luggage" ||
    raw === "luggage" ||
    raw.includes("luggage") ||
    raw.includes("maleta") ||
    raw.includes("equipaje")
  ) {
    return "extra_luggage";
  }

  if (
    raw === "xl" ||
    raw.includes("xl") ||
    raw.includes("extra_grande") ||
    raw.includes("mas_espacio")
  ) {
    return "xl";
  }

  if (
    raw === "standard" ||
    raw.includes("estandar") ||
    raw.includes("normal") ||
    raw.includes("general")
  ) {
    return "standard";
  }

  return null;
}

export function vehicleCategoryLabel(category: VehicleCategory): string {
  return VEHICLE_CATEGORY_CONFIG[category].label;
}

export function vehicleCategoryShortLabel(category: VehicleCategory): string {
  return VEHICLE_CATEGORY_CONFIG[category].shortLabel;
}

export function vehicleCategoryEmoji(category: VehicleCategory): string {
  return VEHICLE_CATEGORY_CONFIG[category].emoji;
}

export function vehicleCategoryDisplay(category: VehicleCategory): string {
  const cfg = VEHICLE_CATEGORY_CONFIG[category];
  return `${cfg.emoji} ${cfg.label}`;
}

export function vehicleCategoriesMatch(
  requested: VehicleCategoryInput,
  driverVehicle: VehicleCategoryInput,
): boolean {
  const a = normalizeVehicleCategory(requested);
  const b = normalizeVehicleCategory(driverVehicle);
  if (a == null || b == null) return true;
  return a === b;
}

/**
 * true → mostrar modal de confirmación antes de accept.
 * Misma categoría o datos incompletos → false (aceptación normal).
 */
export function needsVehicleCategoryConfirmation(
  requestedCategory: VehicleCategoryInput,
  driverVehicleCategory: VehicleCategoryInput,
): boolean {
  const requested = normalizeVehicleCategory(requestedCategory);
  const driver = normalizeVehicleCategory(driverVehicleCategory);
  if (requested == null || driver == null) return false;
  return requested !== driver;
}

export function vehicleCategoryMismatchCopy(
  requestedCategory: VehicleCategory,
): {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  if (requestedCategory === "xl") {
    return {
      title: "Viaje XL",
      body:
        "Este pasajero solicitó un vehículo XL.\n\n" +
        "Tu vehículo está registrado en una categoría diferente.\n\n" +
        "Asegúrate de poder cumplir correctamente con este servicio antes de aceptarlo.",
      confirmLabel: "Confirmar y aceptar XL",
      cancelLabel: "Volver",
    };
  }

  if (requestedCategory === "extra_luggage") {
    return {
      title: "Viaje Extra Maleta",
      body:
        "Este pasajero solicitó Extra Maleta.\n\n" +
        "Asegúrate de contar con espacio suficiente para el equipaje antes de aceptar.",
      confirmLabel: "Tengo espacio y acepto",
      cancelLabel: "Volver",
    };
  }

  return {
    title: "Confirma la categoría",
    body:
      "Este pasajero seleccionó un viaje Estándar.\n\n" +
      "Tu vehículo está registrado en otra categoría.\n\n" +
      "¿Quieres aceptar igualmente este viaje?",
    confirmLabel: "Confirmar y aceptar",
    cancelLabel: "Volver",
  };
}

/** Extrae categoría desde notes legacy si el campo tipado falta. */
export function extractVehicleCategoryFromNotes(
  notes: string | null | undefined,
): VehicleCategory | null {
  const text = String(notes ?? "").trim();
  if (!text) return null;

  const patterns = [
    /Veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /Tipo de veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /Categor[ií]a de veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /Categor[ií]a veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /fareVehicleCategory\s*[:=]\s*([^\n.]+)/i,
    /vehicleCategory\s*[:=]\s*([^\n.]+)/i,
    /requestedVehicleCategory\s*[:=]\s*([^\n.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const normalized = normalizeVehicleCategory(match?.[1]);
    if (normalized) return normalized;
  }

  return null;
}

export function resolveRequestedVehicleCategory(input: {
  requestedVehicleCategory?: VehicleCategoryInput;
  vehicleCategory?: VehicleCategoryInput;
  fareVehicleCategory?: VehicleCategoryInput;
  notes?: string | null;
}): VehicleCategory {
  return (
    normalizeVehicleCategory(input.requestedVehicleCategory) ??
    normalizeVehicleCategory(input.vehicleCategory) ??
    normalizeVehicleCategory(input.fareVehicleCategory) ??
    extractVehicleCategoryFromNotes(input.notes) ??
    "standard"
  );
}
