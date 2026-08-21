/**
 * Categorías de vehículo RAPA GO.
 *
 * Política autoritativa (backend):
 * - STANDARD: cualquier vehículo activo/aprobado puede atender.
 * - XL / EXTRA_LUGGAGE / COMFORT: requieren capacidades aprobadas
 *   independientes (no mutuamente excluyentes).
 * - El cliente NO puede falsificar assigned_vehicle_category.
 * - assigned se deriva de capacidades reales al accept.
 */

export const VEHICLE_CATEGORIES = [
  "standard",
  "xl",
  "extra_luggage",
  "comfort",
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

/**
 * Capacidades independientes del vehículo (pueden coexistir).
 * Un SUV 2024 puede ser XL + Extra Maletas + Confort a la vez.
 */
export type VehicleCapabilities = {
  xl: boolean;
  extraLuggage: boolean;
  comfort: boolean;
  vehicleYear: number | null;
};

export const EMPTY_VEHICLE_CAPABILITIES: VehicleCapabilities = {
  xl: false,
  extraLuggage: false,
  comfort: false,
  vehicleYear: null,
};

/**
 * Comisión de plataforma fija (no depende de la categoría).
 * Confort usa exactamente la misma regla: 23% plataforma / 77% conductor.
 */
export const PLATFORM_COMMISSION_PERCENT = 23;
export const DRIVER_EARNINGS_PERCENT = 77;

/**
 * Año mínimo técnico por defecto para habilitar Confort vía administración.
 * Administración puede sobrescribirlo (fare_settings / config).
 * No es una política comercial definitiva — es el valor de arranque.
 */
export const DEFAULT_COMFORT_MIN_VEHICLE_YEAR = 2020;

/**
 * Multiplicador técnico de arranque para Confort en el motor de tarifas.
 * Administración puede cambiarlo. Tests deben fijar el valor vía fixture.
 */
export const DEFAULT_COMFORT_FARE_MULTIPLIER = 1.35;

export const VEHICLE_NOT_ELIGIBLE_CODE =
  "VEHICLE_NOT_ELIGIBLE_FOR_REQUESTED_CATEGORY" as const;

export const VEHICLE_CATEGORY_CONFIG: Record<
  VehicleCategory,
  {
    label: string;
    shortLabel: string;
    emoji: string;
    listHint: string | null;
    passengerHint: string;
  }
> = {
  standard: {
    label: "Estándar",
    shortLabel: "Estándar",
    emoji: "🚗",
    listHint: null,
    passengerHint: "Viaje estándar",
  },
  xl: {
    label: "XL",
    shortLabel: "XL",
    emoji: "🚐",
    listHint: "Viaje solicitado como XL",
    passengerHint: "Mayor capacidad para pasajeros",
  },
  extra_luggage: {
    label: "Extra Maleta",
    shortLabel: "Extra Maleta",
    emoji: "🧳",
    listHint: "Requiere espacio adicional para equipaje",
    passengerHint: "Vehículo con capacidad adicional para equipaje",
  },
  comfort: {
    label: "Confort",
    shortLabel: "Confort",
    emoji: "✨",
    listHint: "Viaje solicitado como Confort",
    passengerHint:
      "Vehículos más nuevos y aprobados para una experiencia superior",
  },
};

export function isVehicleCategory(value: unknown): value is VehicleCategory {
  return (
    value === "standard" ||
    value === "xl" ||
    value === "extra_luggage" ||
    value === "comfort"
  );
}

/**
 * Normaliza cualquier etiqueta/alias (incl. `luggage`, `confort`, texts en notes)
 * a la categoría canónica. Devuelve null si no reconoce.
 */
export function normalizeVehicleCategory(
  value: unknown,
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
    raw === "comfort" ||
    raw === "confort" ||
    raw.includes("comfort") ||
    raw.includes("confort")
  ) {
    return "comfort";
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

export function vehicleCategoryPassengerHint(
  category: VehicleCategory,
): string {
  return VEHICLE_CATEGORY_CONFIG[category].passengerHint;
}

/**
 * Migra categoría legacy única → capacidades no excluyentes.
 */
export function capabilitiesFromLegacyCategory(
  category: VehicleCategoryInput,
  vehicleYear: number | null = null,
): VehicleCapabilities {
  const normalized = normalizeVehicleCategory(category);
  return {
    xl: normalized === "xl",
    extraLuggage: normalized === "extra_luggage",
    comfort: normalized === "comfort",
    vehicleYear,
  };
}

/**
 * Deriva una etiqueta primaria de display desde capacidades
 * (prioridad: comfort > xl > extra_luggage > standard).
 * No implica exclusividad — solo compatibilidad con campos legacy.
 */
export function primaryCategoryFromCapabilities(
  capabilities: VehicleCapabilities,
): VehicleCategory {
  if (capabilities.comfort) return "comfort";
  if (capabilities.xl) return "xl";
  if (capabilities.extraLuggage) return "extra_luggage";
  return "standard";
}

/**
 * Fuente de verdad de elegibilidad: ¿puede este vehículo atender requested?
 *
 * STANDARD → siempre (vehículo activo/aprobado asumido por el caller).
 * XL → capability xl.
 * EXTRA_LUGGAGE → capability extraLuggage (XL sola NO alcanza).
 * COMFORT → capability comfort + año >= mínimo configurado (recheck en accept).
 */
export function isVehicleEligibleForRequestedCategory(
  capabilities: VehicleCapabilities,
  requestedCategory: VehicleCategoryInput,
  options: { comfortMinVehicleYear?: number } = {},
): boolean {
  const requested =
    normalizeVehicleCategory(requestedCategory) ?? "standard";
  const minYear =
    options.comfortMinVehicleYear ?? DEFAULT_COMFORT_MIN_VEHICLE_YEAR;

  if (requested === "standard") return true;
  if (requested === "xl") return capabilities.xl === true;
  if (requested === "extra_luggage") return capabilities.extraLuggage === true;
  if (requested === "comfort") {
    return (
      capabilities.comfort === true &&
      isComfortVehicleYearEligible(capabilities.vehicleYear, minYear)
    );
  }
  return false;
}

export function vehicleEligibilityFailureMessage(
  requestedCategory: VehicleCategory,
): string {
  if (requestedCategory === "xl") {
    return "Tu vehículo actual no está aprobado para viajes XL.";
  }
  if (requestedCategory === "extra_luggage") {
    return "Tu vehículo actual no está aprobado para Extra Maletas.";
  }
  if (requestedCategory === "comfort") {
    return "Tu vehículo actual no cumple los requisitos Confort (aprobación y/o año mínimo).";
  }
  return "Tu vehículo actual no cumple los requisitos de este tipo de viaje.";
}

/**
 * Snapshot assigned al accept: refleja el servicio solicitado cuando es elegible.
 * Para standard atendido por vehículo superior, registra la capacidad primaria real.
 */
export function resolveAssignedCategoryFromCapabilities(
  capabilities: VehicleCapabilities,
  requestedCategory: VehicleCategoryInput,
): VehicleCategory {
  const requested =
    normalizeVehicleCategory(requestedCategory) ?? "standard";
  if (requested === "standard") {
    return primaryCategoryFromCapabilities(capabilities);
  }
  return requested;
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
 * @deprecated Prefer isVehicleEligibleForRequestedCategory con capacidades.
 * Conservado para compatibilidad UI legacy; no autoriza accept backend.
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
  return {
    title: `Viaje ${vehicleCategoryLabel(requestedCategory)}`,
    body: vehicleEligibilityFailureMessage(requestedCategory),
    confirmLabel: "Entendido",
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

/**
 * Split de comisión autoritativo: 23% plataforma / 77% conductor.
 * Redondeo de plataforma con Math.round; el conductor recibe el resto
 * para que la suma siempre coincida con el fare final.
 */
export function splitPlatformCommission(finalFareClp: number): {
  finalFareClp: number;
  platformFeeClp: number;
  driverAmountClp: number;
  platformPercent: number;
  driverPercent: number;
} {
  const safeFare = Math.max(0, Math.round(Number(finalFareClp) || 0));
  const platformFeeClp = Math.round(
    safeFare * (PLATFORM_COMMISSION_PERCENT / 100),
  );
  return {
    finalFareClp: safeFare,
    platformFeeClp,
    driverAmountClp: safeFare - platformFeeClp,
    platformPercent: PLATFORM_COMMISSION_PERCENT,
    driverPercent: DRIVER_EARNINGS_PERCENT,
  };
}

/**
 * Elegibilidad Confort por año: recheck en cada accept con el mínimo vigente.
 */
export function isComfortVehicleYearEligible(
  vehicleYear: number | null | undefined,
  minYear: number = DEFAULT_COMFORT_MIN_VEHICLE_YEAR,
): boolean {
  if (vehicleYear == null || !Number.isFinite(Number(vehicleYear))) {
    return false;
  }
  return Number(vehicleYear) >= minYear;
}
