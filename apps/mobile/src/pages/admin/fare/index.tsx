import React, { useCallback, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import {
  add,
  cashOutline,
  createOutline,
  mapOutline,
  refreshOutline,
  saveOutline,
  settingsOutline,
  speedometerOutline,
  trashOutline,
} from "ionicons/icons";

type PassengerKey = "resident" | "chilean" | "foreigner";
type VehicleKey = "standard" | "xl" | "luggage";
type RoundingMode = "ceil" | "nearest" | "none";

type RuralConfig = {
  urbanLimitKm: number;
  ruralDiscountPercent: number;
  ruralFactor: number;
};

type FixedDestinationRule = {
  id: string;
  title: string;
  tripType: string;
  baseResidentClp: number;
  active: boolean;
};

type FareEngineConfig = {
  urban: {
    includedKm: number;
    baseMinimumClp: number;
    baseKmClp: number;
  };
  rural: RuralConfig;
  passengerMultipliers: Record<PassengerKey, number>;
  vehicleMultipliers: Record<VehicleKey, number>;
  passengerActive: Record<PassengerKey, boolean>;
  vehicleActive: Record<VehicleKey, boolean>;
  fixedDestinations: FixedDestinationRule[];
  rounding: {
    mode: RoundingMode;
    unitClp: number;
  };
  usdRate: number;
  updatedAt: string;
};

type CompatibilityFareRule = {
  id: string;
  kind: "variable" | "fixed";
  title: string;
  minimumClp: number | null;
  kmClp: number | null;
  ruralKmClp?: number | null;
  fixedClp: number | null;
  description: string;
  active: boolean;
  passenger?: PassengerKey;
  vehicle?: VehicleKey;
  destinationId?: string;
  editableKind:
    | "base_minimum"
    | "base_km"
    | "generated_variable"
    | "generated_fixed";
};

type EditorKind =
  | "base_minimum"
  | "base_km"
  | "included_km"
  | "rural_limit"
  | "rural_discount"
  | "rounding"
  | "usd_rate"
  | "passenger"
  | "vehicle"
  | "fixed_destination"
  | "generated_variable"
  | "generated_fixed";

type EditorState = {
  kind: EditorKind;
  title: string;
  helper: string;

  value?: string;
  valueUsd?: string;

  roundingMode?: RoundingMode;

  passenger?: PassengerKey;
  vehicle?: VehicleKey;
  destinationId?: string | null;

  passengerMultiplier?: string;
  vehicleMultiplier?: string;
  passengerActive?: "yes" | "no";
  vehicleActive?: "yes" | "no";

  name?: string;
  tripType?: string;
  baseResidentClp?: string;
  baseResidentUsd?: string;
  destinationActive?: "yes" | "no";
};

type AuditItem = {
  at: string;
  action: string;
  snapshot: FareEngineConfig;
};

const ENGINE_STORAGE_KEY = "rapago_admin_fare_engine_v1";
const COMPATIBILITY_RULES_STORAGE_KEY = "rapago_admin_fare_cards_rules_v1";
const USD_RATE_STORAGE_KEY = "rapago_admin_fare_cards_usd_rate_v1";
const AUDIT_STORAGE_KEY = "rapago_admin_fare_engine_audit_v1";

const PASSENGER_LABEL: Record<PassengerKey, string> = {
  resident: "Residente Rapa Nui",
  chilean: "Turista chileno",
  foreigner: "Turista extranjero",
};

const VEHICLE_LABEL: Record<VehicleKey, string> = {
  standard: "General / estándar",
  xl: "Vehículo XL",
  luggage: "Vehículo extra maletas",
};

const VEHICLE_DESCRIPTION: Record<VehicleKey, string> = {
  standard: "Tarifa base urbana.",
  xl: "Mayor capacidad o comodidad.",
  luggage: "Orientado a viajes con equipaje relevante.",
};

const DEFAULT_CONFIG: FareEngineConfig = {
  urban: {
    includedKm: 2,
    baseMinimumClp: 5000,
    baseKmClp: 1000,
  },
  rural: {
    urbanLimitKm: 6,
    ruralDiscountPercent: 25,
    ruralFactor: 0.75,
  },
  passengerMultipliers: {
    resident: 1,
    chilean: 1.13,
    foreigner: 1.2,
  },
  vehicleMultipliers: {
    standard: 1,
    xl: 1.4,
    luggage: 1.25,
  },
  passengerActive: {
    resident: true,
    chilean: true,
    foreigner: true,
  },
  vehicleActive: {
    standard: true,
    xl: true,
    luggage: true,
  },
  fixedDestinations: [
    {
      id: "anakena",
      title: "Anakena",
      tripType: "Ida y vuelta",
      baseResidentClp: 38000,
      active: true,
    },
    {
      id: "terevaka",
      title: "Terevaka",
      tripType: "Ida y vuelta",
      baseResidentClp: 20000,
      active: true,
    },
  ],
  rounding: {
    // Redondeo final obligatorio: siempre hacia arriba a múltiplos de $100.
    // No se redondea por kilómetro ni por tramo.
    mode: "ceil",
    unitClp: 100,
  },
  usdRate: 1000,
  updatedAt: new Date().toISOString(),
};

const pageBackground: React.CSSProperties = {
  "--background":
    "linear-gradient(180deg, rgba(15,15,15,.68), rgba(15,15,15,.88)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
} as React.CSSProperties;

const shellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  margin: "0 auto",
  padding: "14px 14px 96px",
};

const cardStyle: React.CSSProperties = {
  margin: "0 0 14px",
  borderRadius: 18,
  background: "#F6F2EC",
  color: "#111111",
  border: "1px solid rgba(210,164,58,.45)",
  boxShadow: "0 16px 36px rgba(0,0,0,.22)",
};

const innerCardStyle: React.CSSProperties = {
  "--background": "#ffffff",
  "--color": "#111111",
  "--padding-start": "12px",
  "--inner-padding-end": "8px",
  "--min-height": "auto",
  marginBottom: "10px",
  borderRadius: "18px",
  border: "1px solid rgba(210,164,58,.35)",
  overflow: "hidden",
} as React.CSSProperties;

function cloneDefaultConfig(): FareEngineConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as FareEngineConfig;
}

function normalizeId(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function parseMoney(value: string | undefined | null, fallback = 0): number {
  const cleaned = String(value ?? "")
    .replace(/\$/g, "")
    .replace(/CLP/gi, "")
    .replace(/USD/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function parseMultiplier(value: string | undefined | null, fallback = 1): number {
  const cleaned = String(value ?? "")
    .replace(/x/gi, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatClp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";

  const numeric = Number(value);
  return `$${numeric.toLocaleString("es-CL", {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 1,
  })}`;
}

function formatClpInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";

  const numeric = Number(value);
  return numeric.toLocaleString("es-CL", {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 1,
  });
}

function formatUsd(value: number | null | undefined, usdRate: number): string {
  if (value == null || !Number.isFinite(Number(value)) || usdRate <= 0) return "—";

  const usd = Number(value) / usdRate;
  return usd.toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatUsdInput(value: number | null | undefined, usdRate: number): string {
  if (value == null || !Number.isFinite(Number(value)) || usdRate <= 0) return "";
  return formatUsd(value, usdRate);
}

function formatMultiplier(value: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 4,
  });
}

function getActiveRecord<T extends string>(
  source: Partial<Record<T, boolean>> | undefined,
  keys: T[],
): Record<T, boolean> {
  return keys.reduce((acc, key) => {
    acc[key] = source?.[key] !== false;
    return acc;
  }, {} as Record<T, boolean>);
}

function roundByRule(value: number, config: FareEngineConfig): number {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;

  // REDONDEO FINAL OBLIGATORIO
  // Se aplica solamente al total final que se mostrará/cobrará.
  // No se aplica por kilómetro, por tramo urbano ni por tramo rural.
  const unit = Math.max(100, Math.round(config.rounding.unitClp || 100));

  return Math.ceil(safe / unit) * unit;
}

function getUrbanMinimum(
  config: FareEngineConfig,
  passenger: PassengerKey,
  vehicle: VehicleKey,
): number {
  return (
    config.urban.baseMinimumClp *
    (config.passengerMultipliers[passenger] ?? 1) *
    (config.vehicleMultipliers[vehicle] ?? 1)
  );
}

function getUrbanKm(
  config: FareEngineConfig,
  passenger: PassengerKey,
  vehicle: VehicleKey,
): number {
  return (
    config.urban.baseKmClp *
    (config.passengerMultipliers[passenger] ?? 1) *
    (config.vehicleMultipliers[vehicle] ?? 1)
  );
}

function getRuralFactor(config: FareEngineConfig): number {
  const discount = Number(config.rural?.ruralDiscountPercent ?? 25);
  const factorFromDiscount = 1 - Math.max(0, Math.min(100, discount)) / 100;
  const configuredFactor = Number(config.rural?.ruralFactor ?? factorFromDiscount);

  return Number.isFinite(configuredFactor) && configuredFactor > 0
    ? configuredFactor
    : factorFromDiscount;
}

function getRuralKm(
  config: FareEngineConfig,
  passenger: PassengerKey,
  vehicle: VehicleKey,
): number {
  // Regla corregida:
  // 1) KM urbano base
  // 2) multiplicador pasajero
  // 3) multiplicador vehículo
  // 4) descuento rural del 25%
  return getUrbanKm(config, passenger, vehicle) * getRuralFactor(config);
}

function calculateUrbanRuralExact(
  config: FareEngineConfig,
  passenger: PassengerKey,
  vehicle: VehicleKey,
  distanceKm: number,
): number {
  const safeDistance = Math.max(0, Number(distanceKm) || 0);
  const urbanLimitKm = Math.max(0, Number(config.rural?.urbanLimitKm ?? 6));

  if (safeDistance <= urbanLimitKm) {
    return calculateUrbanExact(config, passenger, vehicle, safeDistance);
  }

  const urbanFareUpToLimit = calculateUrbanExact(config, passenger, vehicle, urbanLimitKm);
  const ruralKm = safeDistance - urbanLimitKm;
  const ruralKmFare = getRuralKm(config, passenger, vehicle);

  return urbanFareUpToLimit + ruralKm * ruralKmFare;
}

function calculateUrbanExact(
  config: FareEngineConfig,
  passenger: PassengerKey,
  vehicle: VehicleKey,
  distanceKm: number,
): number {
  const additionalKm = Math.max(0, distanceKm - config.urban.includedKm);
  return getUrbanMinimum(config, passenger, vehicle) + additionalKm * getUrbanKm(config, passenger, vehicle);
}

function getFixedFare(
  config: FareEngineConfig,
  destination: FixedDestinationRule,
  passenger: PassengerKey,
): number {
  return destination.baseResidentClp * (config.passengerMultipliers[passenger] ?? 1);
}

function readStoredConfig(): FareEngineConfig {
  try {
    const raw = localStorage.getItem(ENGINE_STORAGE_KEY);
    const fallback = cloneDefaultConfig();

    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<FareEngineConfig>;

    return {
      urban: {
        includedKm: Number(parsed.urban?.includedKm ?? fallback.urban.includedKm),
        baseMinimumClp: Number(parsed.urban?.baseMinimumClp ?? fallback.urban.baseMinimumClp),
        baseKmClp: Number(parsed.urban?.baseKmClp ?? fallback.urban.baseKmClp),
      },
      rural: {
        urbanLimitKm: Math.max(0, Number(parsed.rural?.urbanLimitKm ?? fallback.rural.urbanLimitKm)),
        ruralDiscountPercent: Math.max(
          0,
          Math.min(100, Number(parsed.rural?.ruralDiscountPercent ?? fallback.rural.ruralDiscountPercent)),
        ),
        ruralFactor: Math.max(
          0,
          Number(
            parsed.rural?.ruralFactor ??
              1 - Number(parsed.rural?.ruralDiscountPercent ?? fallback.rural.ruralDiscountPercent) / 100,
          ),
        ),
      },
      passengerMultipliers: {
        resident: Number(parsed.passengerMultipliers?.resident ?? fallback.passengerMultipliers.resident),
        chilean: Number(parsed.passengerMultipliers?.chilean ?? fallback.passengerMultipliers.chilean),
        foreigner: Number(parsed.passengerMultipliers?.foreigner ?? fallback.passengerMultipliers.foreigner),
      },
      vehicleMultipliers: {
        standard: Number(parsed.vehicleMultipliers?.standard ?? fallback.vehicleMultipliers.standard),
        xl: Number(parsed.vehicleMultipliers?.xl ?? fallback.vehicleMultipliers.xl),
        luggage: Number(parsed.vehicleMultipliers?.luggage ?? fallback.vehicleMultipliers.luggage),
      },
      passengerActive: getActiveRecord<PassengerKey>(
        parsed.passengerActive,
        ["resident", "chilean", "foreigner"],
      ),
      vehicleActive: getActiveRecord<VehicleKey>(
        parsed.vehicleActive,
        ["standard", "xl", "luggage"],
      ),
      fixedDestinations:
        Array.isArray(parsed.fixedDestinations) && parsed.fixedDestinations.length > 0
          ? parsed.fixedDestinations.map((item, index) => ({
              id: normalizeId(item.id || item.title || `destino_${index + 1}`, `destino_${index + 1}`),
              title: String(item.title || `Destino ${index + 1}`),
              tripType: String(item.tripType || "Ida y vuelta"),
              baseResidentClp: Number(item.baseResidentClp || 0),
              active: item.active !== false,
            }))
          : fallback.fixedDestinations,
      rounding: {
        // Forzamos redondeo final superior a $100 aunque existan reglas antiguas en localStorage.
        mode: "ceil",
        unitClp: Math.max(100, Number(parsed.rounding?.unitClp ?? fallback.rounding.unitClp)),
      },
      usdRate: Math.max(1, Number(parsed.usdRate ?? fallback.usdRate)),
      updatedAt: parsed.updatedAt ?? fallback.updatedAt,
    };
  } catch {
    return cloneDefaultConfig();
  }
}

function buildCompatibilityRules(config: FareEngineConfig): CompatibilityFareRule[] {
  const rules: CompatibilityFareRule[] = [
    {
      id: "general_minimum",
      kind: "variable",
      title: `Tarifa general mínima (0 a ${config.urban.includedKm} kms)`,
      minimumClp: config.urban.baseMinimumClp,
      kmClp: null,
      ruralKmClp: null,
      fixedClp: null,
      description: `Tarifa mínima urbana. Incluye los primeros ${config.urban.includedKm} km.`,
      active: true,
      editableKind: "base_minimum",
    },
    {
      id: "general_km",
      kind: "variable",
      title: "Tarifa general por km (con mínimo)",
      minimumClp: null,
      kmClp: config.urban.baseKmClp,
      ruralKmClp: config.urban.baseKmClp * getRuralFactor(config),
      fixedClp: null,
      description: `Valor base por km adicional urbano. El KM rural Residente Rapa Nui estándar queda en ${formatClp(config.urban.baseKmClp * getRuralFactor(config))}.`,
      active: true,
      editableKind: "base_km",
    },
  ];

  const passengerIds: Record<PassengerKey, string> = {
    resident: "resident",
    chilean: "chilean",
    foreigner: "foreigner",
  };

  const vehicleIds: Record<VehicleKey, string> = {
    standard: "standard",
    xl: "xl",
    luggage: "luggage",
  };

  for (const vehicle of Object.keys(VEHICLE_LABEL) as VehicleKey[]) {
    for (const passenger of Object.keys(PASSENGER_LABEL) as PassengerKey[]) {
      const id =
        vehicle === "standard"
          ? `${passengerIds[passenger]}_standard`
          : `${vehicleIds[vehicle]}_${passengerIds[passenger]}`;

      rules.push({
        id,
        kind: "variable",
        title: `Tarifa ${VEHICLE_LABEL[vehicle].toLowerCase()} · ${PASSENGER_LABEL[passenger]}`,
        minimumClp: getUrbanMinimum(config, passenger, vehicle),
        kmClp: getUrbanKm(config, passenger, vehicle),
        ruralKmClp: getRuralKm(config, passenger, vehicle),
        fixedClp: null,
        description: `${PASSENGER_LABEL[passenger]} · ${VEHICLE_LABEL[vehicle]}. Rural: KM urbano ajustado x ${formatMultiplier(getRuralFactor(config))}.`,
        active: config.passengerActive[passenger] !== false && config.vehicleActive[vehicle] !== false,
        passenger,
        vehicle,
        editableKind: "generated_variable",
      });
    }
  }

  for (const destination of config.fixedDestinations) {
    for (const passenger of Object.keys(PASSENGER_LABEL) as PassengerKey[]) {
      rules.push({
        id: `${destination.id}_${passengerIds[passenger]}_roundtrip`,
        kind: "fixed",
        title: `Tarifa destino ${destination.title} (${PASSENGER_LABEL[passenger]}) ${destination.tripType}`,
        minimumClp: null,
        kmClp: null,
        ruralKmClp: null,
        fixedClp: getFixedFare(config, destination, passenger),
        description: `Destino fijo ${destination.title} · ${PASSENGER_LABEL[passenger]} · ${destination.tripType}.`,
        active: destination.active !== false && config.passengerActive[passenger] !== false,
        passenger,
        destinationId: destination.id,
        editableKind: "generated_fixed",
      });
    }
  }

  return rules;
}

function appendAudit(config: FareEngineConfig, action: string): void {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as AuditItem[]) : [];
    const next = [
      {
        at: new Date().toISOString(),
        action,
        snapshot: config,
      },
      ...current,
    ].slice(0, 50);

    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // No bloquea guardado si localStorage falla.
  }
}

function saveCompatibilityRules(config: FareEngineConfig): void {
  try {
    localStorage.setItem(
      COMPATIBILITY_RULES_STORAGE_KEY,
      JSON.stringify(buildCompatibilityRules(config)),
    );
    localStorage.setItem(USD_RATE_STORAGE_KEY, String(config.usdRate));
  } catch {
    // No bloquea la pantalla si localStorage no está disponible.
  }
}

function saveConfig(config: FareEngineConfig, action = "Actualización de tarifas"): FareEngineConfig {
  const next = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(ENGINE_STORAGE_KEY, JSON.stringify(next));
  saveCompatibilityRules(next);
  appendAudit(next, action);

  return next;
}

function getRoundingLabel(config: FareEngineConfig): string {
  const unit = Math.max(100, Math.round(config.rounding.unitClp || 100));
  return `Final obligatorio: múltiplo de $${unit.toLocaleString("es-CL")} superior`;
}

function getRuleEditTitle(rule: CompatibilityFareRule): string {
  if (rule.editableKind === "base_minimum") return "Editar tarifa mínima base";
  if (rule.editableKind === "base_km") return "Editar tarifa por km base";
  if (rule.editableKind === "generated_fixed") return "Editar tarifa fija generada";
  return "Editar regla generada";
}

export function AdminFareSettingsPage(): React.ReactElement {
  const [config, setConfig] = useState<FareEngineConfig>(() => readStoredConfig());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const generatedRules = useMemo(() => buildCompatibilityRules(config), [config]);

  const standardTests = useMemo(() => {
    const distances = [1, 2, 3, 4, 5, 6];

    return distances.map((km) => ({
      km,
      resident: roundByRule(calculateUrbanRuralExact(config, "resident", "standard", km), config),
      chilean: roundByRule(calculateUrbanRuralExact(config, "chilean", "standard", km), config),
      foreigner: roundByRule(calculateUrbanRuralExact(config, "foreigner", "standard", km), config),
    }));
  }, [config]);

  const ruralTests = useMemo(() => {
    const examples = [
      {
        title: "Anakena ida y vuelta",
        km: 44,
      },
      {
        title: "Ejemplo rural 10 km",
        km: 10,
      },
    ];

    return examples.map((row) => {
      const urbanKm = Math.min(row.km, config.rural.urbanLimitKm);
      const ruralKm = Math.max(0, row.km - config.rural.urbanLimitKm);

      return {
        ...row,
        urbanKm,
        ruralKm,
        resident: roundByRule(calculateUrbanRuralExact(config, "resident", "standard", row.km), config),
        chilean: roundByRule(calculateUrbanRuralExact(config, "chilean", "standard", row.km), config),
        foreigner: roundByRule(calculateUrbanRuralExact(config, "foreigner", "standard", row.km), config),
      };
    });
  }, [config]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stored = readStoredConfig();
      setConfig(stored);
      saveCompatibilityRules(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las tarifas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useIonViewWillEnter(() => {
    void load();
  });

  function persist(nextConfig: FareEngineConfig, message = "Cambios guardados."): void {
    const saved = saveConfig(nextConfig, message);
    setConfig(saved);
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 2600);
  }

  function restoreDefaults(): void {
    const next = cloneDefaultConfig();
    persist(next, "Reglas restauradas según el esquema técnico.");
  }

  function openCurrencyEditor(
    kind: "base_minimum" | "base_km" | "usd_rate",
    title: string,
    helper: string,
    clpValue: number,
  ): void {
    setError(null);
    setEditor({
      kind,
      title,
      helper,
      value: formatClpInput(clpValue),
      valueUsd: formatUsdInput(clpValue, config.usdRate),
    });
  }

  function openIncludedKmEditor(): void {
    setError(null);
    setEditor({
      kind: "included_km",
      title: "Editar kilómetros incluidos",
      helper: "Cantidad de kilómetros que se incluyen en la tarifa mínima.",
      value: String(config.urban.includedKm).replace(".", ","),
    });
  }

  function openRuralLimitEditor(): void {
    setError(null);
    setEditor({
      kind: "rural_limit",
      title: "Editar límite de zona urbana",
      helper: "Desde este kilometraje en adelante se activa el cálculo rural. Ejemplo: 6 km urbanos y el excedente como rural.",
      value: String(config.rural.urbanLimitKm).replace(".", ","),
    });
  }

  function openRuralDiscountEditor(): void {
    setError(null);
    setEditor({
      kind: "rural_discount",
      title: "Editar descuento rural",
      helper: "El descuento se aplica después de multiplicador pasajero y multiplicador vehículo.",
      value: String(config.rural.ruralDiscountPercent).replace(".", ","),
    });
  }

  function openRoundingEditor(): void {
    setError(null);
    setEditor({
      kind: "rounding",
      title: "Editar regla de redondeo",
      helper: "Obligatorio: se aplica solo al total final del viaje.",
      value: formatClpInput(config.rounding.unitClp),
      roundingMode: config.rounding.mode,
    });
  }

  function openPassengerEditor(passenger: PassengerKey): void {
    setError(null);
    setEditor({
      kind: "passenger",
      title: `Editar ${PASSENGER_LABEL[passenger]}`,
      helper: "Este multiplicador se aplica a tarifa mínima, tarifa KM y tarifas fijas.",
      passenger,
      passengerMultiplier: formatMultiplier(config.passengerMultipliers[passenger]),
      passengerActive: config.passengerActive[passenger] === false ? "no" : "yes",
    });
  }

  function openVehicleEditor(vehicle: VehicleKey): void {
    setError(null);
    setEditor({
      kind: "vehicle",
      title: `Editar ${VEHICLE_LABEL[vehicle]}`,
      helper: "El pasajero elige una sola categoría por viaje.",
      vehicle,
      vehicleMultiplier: formatMultiplier(config.vehicleMultipliers[vehicle]),
      vehicleActive: config.vehicleActive[vehicle] === false ? "no" : "yes",
    });
  }

  function openFixedEditor(destination?: FixedDestinationRule): void {
    setError(null);
    setEditor({
      kind: "fixed_destination",
      title: destination ? "Editar destino fijo" : "Agregar destino fijo",
      helper: "La tarifa base corresponde al precio Residente Rapa Nui. Turista chileno y Turista extranjero se calculan automáticamente.",
      destinationId: destination?.id ?? null,
      name: destination?.title ?? "",
      tripType: destination?.tripType ?? "Ida y vuelta",
      baseResidentClp: formatClpInput(destination?.baseResidentClp ?? 0),
      baseResidentUsd: formatUsdInput(destination?.baseResidentClp ?? 0, config.usdRate),
      destinationActive: destination?.active === false ? "no" : "yes",
    });
  }

  function openGeneratedVariableEditor(rule: CompatibilityFareRule): void {
    if (!rule.passenger || !rule.vehicle) return;

    setError(null);
    setEditor({
      kind: "generated_variable",
      title: `Editar ${PASSENGER_LABEL[rule.passenger]} · ${VEHICLE_LABEL[rule.vehicle]}`,
      helper: "Esta tarjeta se modifica editando los multiplicadores que generan su precio. Así mantenemos el motor: tarifa base x pasajero x vehículo.",
      passenger: rule.passenger,
      vehicle: rule.vehicle,
      passengerMultiplier: formatMultiplier(config.passengerMultipliers[rule.passenger]),
      vehicleMultiplier: formatMultiplier(config.vehicleMultipliers[rule.vehicle]),
      passengerActive: config.passengerActive[rule.passenger] === false ? "no" : "yes",
      vehicleActive: config.vehicleActive[rule.vehicle] === false ? "no" : "yes",
    });
  }

  function openGeneratedFixedEditor(rule: CompatibilityFareRule): void {
    if (!rule.destinationId || !rule.passenger) return;

    const destination = config.fixedDestinations.find((item) => item.id === rule.destinationId);
    if (!destination) return;

    setError(null);
    setEditor({
      kind: "generated_fixed",
      title: `Editar ${destination.title} · ${PASSENGER_LABEL[rule.passenger]}`,
      helper: "Esta tarifa fija se genera con tarifa base Residente Rapa Nui x multiplicador del pasajero.",
      destinationId: destination.id,
      passenger: rule.passenger,
      name: destination.title,
      tripType: destination.tripType,
      baseResidentClp: formatClpInput(destination.baseResidentClp),
      baseResidentUsd: formatUsdInput(destination.baseResidentClp, config.usdRate),
      destinationActive: destination.active === false ? "no" : "yes",
      passengerMultiplier: formatMultiplier(config.passengerMultipliers[rule.passenger]),
      passengerActive: config.passengerActive[rule.passenger] === false ? "no" : "yes",
    });
  }

  function openRuleEditor(rule: CompatibilityFareRule): void {
    if (rule.editableKind === "base_minimum") {
      openCurrencyEditor(
        "base_minimum",
        "Editar tarifa mínima base",
        "Valor base Residente Rapa Nui para vehículo estándar. También puedes editarlo en USD.",
        config.urban.baseMinimumClp,
      );
      return;
    }

    if (rule.editableKind === "base_km") {
      openCurrencyEditor(
        "base_km",
        "Editar tarifa por km base",
        "Valor base por kilómetro adicional. También puedes editarlo en USD.",
        config.urban.baseKmClp,
      );
      return;
    }

    if (rule.editableKind === "generated_fixed") {
      openGeneratedFixedEditor(rule);
      return;
    }

    openGeneratedVariableEditor(rule);
  }

  function closeEditor(): void {
    setEditor(null);
    setSaving(false);
    setError(null);
  }

  function updateEditor(changes: Partial<EditorState>): void {
    setEditor((current) => {
      if (!current) return current;
      return { ...current, ...changes };
    });
  }

  function updateCurrencyFromClp(value: string): void {
    const clp = parseMoney(value, 0);
    updateEditor({
      value: value,
      valueUsd: formatUsdInput(clp, config.usdRate),
    });
  }

  function updateCurrencyFromUsd(value: string): void {
    const usd = parseMoney(value, 0);
    const clp = Math.round(usd * config.usdRate);
    updateEditor({
      valueUsd: value,
      value: formatClpInput(clp),
    });
  }

  function updateFixedClp(value: string): void {
    const clp = parseMoney(value, 0);
    updateEditor({
      baseResidentClp: value,
      baseResidentUsd: formatUsdInput(clp, config.usdRate),
    });
  }

  function updateFixedUsd(value: string): void {
    const usd = parseMoney(value, 0);
    const clp = Math.round(usd * config.usdRate);
    updateEditor({
      baseResidentUsd: value,
      baseResidentClp: formatClpInput(clp),
    });
  }

  async function handleSaveEditor(): Promise<void> {
    if (!editor) return;

    setSaving(true);
    setError(null);

    try {
      if (editor.kind === "base_minimum") {
        const parsed = Math.round(parseMoney(editor.value, config.urban.baseMinimumClp));
        if (parsed <= 0) {
          setError("La tarifa mínima debe ser mayor que cero.");
          return;
        }

        persist(
          {
            ...config,
            urban: { ...config.urban, baseMinimumClp: parsed },
          },
          "Tarifa mínima base actualizada.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "base_km") {
        const parsed = Math.round(parseMoney(editor.value, config.urban.baseKmClp));
        if (parsed <= 0) {
          setError("La tarifa por km debe ser mayor que cero.");
          return;
        }

        persist(
          {
            ...config,
            urban: { ...config.urban, baseKmClp: parsed },
          },
          "Tarifa por km base actualizada.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "included_km") {
        const parsed = parseMoney(editor.value, config.urban.includedKm);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setError("Los kilómetros incluidos no pueden ser negativos.");
          return;
        }

        persist(
          {
            ...config,
            urban: { ...config.urban, includedKm: parsed },
          },
          "Kilómetros incluidos actualizados.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "rural_limit") {
        const parsed = parseMoney(editor.value, config.rural.urbanLimitKm);
        if (!Number.isFinite(parsed) || parsed <= config.urban.includedKm) {
          setError(`El límite rural debe ser mayor que los ${config.urban.includedKm} km incluidos.`);
          return;
        }

        persist(
          {
            ...config,
            rural: { ...config.rural, urbanLimitKm: parsed },
          },
          "Límite de zona urbana actualizado.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "rural_discount") {
        const parsed = parseMoney(editor.value, config.rural.ruralDiscountPercent);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) {
          setError("El descuento rural debe estar entre 0 y 99.");
          return;
        }

        persist(
          {
            ...config,
            rural: {
              ...config.rural,
              ruralDiscountPercent: parsed,
              ruralFactor: 1 - parsed / 100,
            },
          },
          "Descuento rural actualizado.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "rounding") {
        const unit = Math.max(100, Math.round(parseMoney(editor.value, config.rounding.unitClp)));

        persist(
          {
            ...config,
            rounding: {
              // Redondeo final obligatorio: no permitimos "none" ni "nearest".
              mode: "ceil",
              unitClp: unit,
            },
          },
          "Regla de redondeo final actualizada.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "usd_rate") {
        const rate = Math.round(parseMoney(editor.value, config.usdRate));
        if (rate <= 0) {
          setError("La tasa USD debe ser mayor que cero.");
          return;
        }

        persist(
          {
            ...config,
            usdRate: rate,
          },
          "Tasa USD actualizada.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "passenger" && editor.passenger) {
        const multiplier = parseMultiplier(
          editor.passengerMultiplier,
          config.passengerMultipliers[editor.passenger],
        );

        persist(
          {
            ...config,
            passengerMultipliers: {
              ...config.passengerMultipliers,
              [editor.passenger]: multiplier,
            },
            passengerActive: {
              ...config.passengerActive,
              [editor.passenger]: editor.passengerActive !== "no",
            },
          },
          "Tipo de pasajero actualizado.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "vehicle" && editor.vehicle) {
        const multiplier = parseMultiplier(
          editor.vehicleMultiplier,
          config.vehicleMultipliers[editor.vehicle],
        );

        persist(
          {
            ...config,
            vehicleMultipliers: {
              ...config.vehicleMultipliers,
              [editor.vehicle]: multiplier,
            },
            vehicleActive: {
              ...config.vehicleActive,
              [editor.vehicle]: editor.vehicleActive !== "no",
            },
          },
          "Categoría de vehículo actualizada.",
        );
        closeEditor();
        return;
      }

      if (editor.kind === "generated_variable" && editor.passenger && editor.vehicle) {
        const passengerMultiplier = parseMultiplier(
          editor.passengerMultiplier,
          config.passengerMultipliers[editor.passenger],
        );
        const vehicleMultiplier = parseMultiplier(
          editor.vehicleMultiplier,
          config.vehicleMultipliers[editor.vehicle],
        );

        persist(
          {
            ...config,
            passengerMultipliers: {
              ...config.passengerMultipliers,
              [editor.passenger]: passengerMultiplier,
            },
            vehicleMultipliers: {
              ...config.vehicleMultipliers,
              [editor.vehicle]: vehicleMultiplier,
            },
            passengerActive: {
              ...config.passengerActive,
              [editor.passenger]: editor.passengerActive !== "no",
            },
            vehicleActive: {
              ...config.vehicleActive,
              [editor.vehicle]: editor.vehicleActive !== "no",
            },
          },
          "Regla generada actualizada.",
        );
        closeEditor();
        return;
      }

      if (
        (editor.kind === "fixed_destination" || editor.kind === "generated_fixed") &&
        editor.name != null
      ) {
        const name = editor.name.trim();
        const tripType = (editor.tripType ?? "").trim() || "Ida y vuelta";
        const baseResidentClp = Math.round(parseMoney(editor.baseResidentClp, 0));

        if (name.length < 2) {
          setError("El nombre del destino es obligatorio.");
          return;
        }

        if (baseResidentClp <= 0) {
          setError("La tarifa base Residente Rapa Nui debe ser mayor que cero.");
          return;
        }

        const id = editor.destinationId ?? normalizeId(name, `destino_${Date.now()}`);
        const nextDestination: FixedDestinationRule = {
          id,
          title: name,
          tripType,
          baseResidentClp,
          active: editor.destinationActive !== "no",
        };

        const exists = config.fixedDestinations.some((item) => item.id === id);
        let nextConfig: FareEngineConfig = {
          ...config,
          fixedDestinations: exists
            ? config.fixedDestinations.map((item) =>
                item.id === id ? nextDestination : item,
              )
            : [...config.fixedDestinations, nextDestination],
        };

        if (editor.kind === "generated_fixed" && editor.passenger) {
          const passengerMultiplier = parseMultiplier(
            editor.passengerMultiplier,
            config.passengerMultipliers[editor.passenger],
          );

          nextConfig = {
            ...nextConfig,
            passengerMultipliers: {
              ...nextConfig.passengerMultipliers,
              [editor.passenger]: passengerMultiplier,
            },
            passengerActive: {
              ...nextConfig.passengerActive,
              [editor.passenger]: editor.passengerActive !== "no",
            },
          };
        }

        persist(
          nextConfig,
          exists ? "Destino fijo actualizado." : "Destino fijo agregado.",
        );

        closeEditor();
      }
    } finally {
      setSaving(false);
    }
  }

  function deleteFixedDestination(destination: FixedDestinationRule): void {
    persist(
      {
        ...config,
        fixedDestinations: config.fixedDestinations.filter((item) => item.id !== destination.id),
      },
      "Destino fijo eliminado.",
    );
  }

  function toggleFixedDestination(destination: FixedDestinationRule): void {
    persist(
      {
        ...config,
        fixedDestinations: config.fixedDestinations.map((item) =>
          item.id === destination.id ? { ...item, active: !item.active } : item,
        ),
      },
      destination.active ? "Destino desactivado." : "Destino activado.",
    );
  }

  function renderValueBlock(
    label: string,
    clp: number | null | undefined,
    showRounded = true,
  ): React.ReactElement | null {
    if (clp == null || !Number.isFinite(Number(clp))) {
      return null;
    }

    const rounded = roundByRule(Number(clp), config);

    return (
      <div
        style={{
          background: "#fff8e6",
          border: "1px solid rgba(210,164,58,.32)",
          borderRadius: 14,
          padding: "9px 10px",
          minWidth: 132,
        }}
      >
        <div style={{ color: "#6d5a26", fontSize: ".68rem", fontWeight: 900 }}>
          {label}
        </div>
        <div style={{ color: "#111", fontSize: "1rem", fontWeight: 950, marginTop: 3 }}>
          {formatClp(clp)}
        </div>
        <div style={{ color: "#555", fontSize: ".72rem", fontWeight: 900, marginTop: 2 }}>
          USD {formatUsd(clp, config.usdRate)}
        </div>
        {showRounded && rounded !== clp && (
          <div style={{ color: "#8a6418", fontSize: ".7rem", fontWeight: 950, marginTop: 2 }}>
            Cobra {formatClp(rounded)} · USD {formatUsd(rounded, config.usdRate)}
          </div>
        )}
      </div>
    );
  }

  function renderParameterCard(
    title: string,
    clpLabel: string,
    usdLabel: string,
    helper: string,
    icon: string,
    onEdit: () => void,
  ): React.ReactElement {
    return (
      <IonCard style={cardStyle}>
        <IonCardContent style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                background: "rgba(210,164,58,.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IonIcon icon={icon} style={{ fontSize: 24, color: "#111" }} />
            </div>

            <IonButton
              size="small"
              fill="outline"
              color="warning"
              onClick={onEdit}
              style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
            >
              Editar
            </IonButton>
          </div>

          <div style={{ marginTop: 12, fontWeight: 950, fontSize: ".88rem" }}>{title}</div>
          <div style={{ marginTop: 6, fontSize: "1.45rem", fontWeight: 950, lineHeight: 1.05 }}>
            {clpLabel}
          </div>
          <div style={{ marginTop: 4, color: "#6d5a26", fontSize: ".85rem", fontWeight: 950 }}>
            {usdLabel}
          </div>
          <IonNote style={{ display: "block", marginTop: 8, color: "#666", fontSize: ".78rem" }}>
            {helper}
          </IonNote>
        </IonCardContent>
      </IonCard>
    );
  }

  function renderMultiplierCard(
    title: string,
    value: number,
    active: boolean,
    helper: string,
    onEdit: () => void,
  ): React.ReactElement {
    return (
      <IonItem lines="none" style={innerCardStyle}>
        <div style={{ width: "100%", padding: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div>
              <strong style={{ fontSize: ".94rem" }}>{title}</strong>
              <div style={{ color: "#666", fontSize: ".75rem", marginTop: 4 }}>{helper}</div>
            </div>
            <IonButton
              size="small"
              fill="outline"
              color="warning"
              onClick={onEdit}
              style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
            >
              Editar
            </IonButton>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                background: "#fff8e6",
                border: "1px solid rgba(210,164,58,.32)",
                borderRadius: 14,
                padding: "8px 11px",
                fontWeight: 950,
              }}
            >
              Multiplicador {formatMultiplier(value)}
            </div>
            <IonBadge color={active ? "success" : "medium"}>
              {active ? "Activo" : "Inactivo"}
            </IonBadge>
          </div>
        </div>
      </IonItem>
    );
  }

  function renderGeneratedRule(rule: CompatibilityFareRule): React.ReactElement {
    return (
      <IonItem key={rule.id} lines="none" style={innerCardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            width: "100%",
            padding: "12px 0",
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: "rgba(210,164,58,.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IonIcon
              icon={rule.kind === "fixed" ? mapOutline : rule.kmClp != null ? speedometerOutline : cashOutline}
              style={{ fontSize: 21, color: "#111" }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: ".92rem", lineHeight: 1.2, wordBreak: "break-word" }}>
                  {rule.title}
                </strong>
                <IonBadge color={rule.active ? "success" : "medium"} style={{ fontSize: ".68rem" }}>
                  {rule.active ? "Activa" : "Inactiva"}
                </IonBadge>
                <IonBadge color={rule.kind === "fixed" ? "tertiary" : "warning"} style={{ fontSize: ".68rem" }}>
                  {rule.kind === "fixed" ? "Fija" : "Variable"}
                </IonBadge>
              </div>

              <IonButton
                size="small"
                fill="outline"
                color="warning"
                onClick={() => openRuleEditor(rule)}
                style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
              >
                {getRuleEditTitle(rule)}
              </IonButton>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {rule.kind === "variable" && renderValueBlock("Tarifa mínima", rule.minimumClp)}
              {rule.kind === "variable" && renderValueBlock("KM urbano", rule.kmClp)}
              {rule.kind === "variable" && renderValueBlock("KM rural", rule.ruralKmClp)}
              {rule.kind === "fixed" && renderValueBlock("Tarifa fija", rule.fixedClp)}
            </div>

            <div style={{ color: "#666", fontSize: ".74rem", marginTop: 8, lineHeight: 1.3 }}>
              {rule.description}
            </div>
          </div>
        </div>
      </IonItem>
    );
  }

  function renderEditorContent(): React.ReactElement | null {
    if (!editor) return null;

    const previewPassenger =
      editor.passenger && editor.passengerMultiplier
        ? parseMultiplier(editor.passengerMultiplier, config.passengerMultipliers[editor.passenger])
        : null;
    const previewVehicle =
      editor.vehicle && editor.vehicleMultiplier
        ? parseMultiplier(editor.vehicleMultiplier, config.vehicleMultipliers[editor.vehicle])
        : null;

    const previewVariableMinimum =
      editor.kind === "generated_variable" && previewPassenger != null && previewVehicle != null
        ? config.urban.baseMinimumClp * previewPassenger * previewVehicle
        : null;

    const previewVariableKm =
      editor.kind === "generated_variable" && previewPassenger != null && previewVehicle != null
        ? config.urban.baseKmClp * previewPassenger * previewVehicle
        : null;

    const fixedPreviewBase = parseMoney(editor.baseResidentClp, 0);
    const fixedPreviewPassengerMultiplier =
      editor.passenger && editor.passengerMultiplier
        ? parseMultiplier(editor.passengerMultiplier, config.passengerMultipliers[editor.passenger])
        : null;
    const fixedPreviewFinal =
      fixedPreviewBase > 0 && fixedPreviewPassengerMultiplier != null
        ? fixedPreviewBase * fixedPreviewPassengerMultiplier
        : null;

    return (
      <>
        <IonNote style={{ color: "#444", fontWeight: 800 }}>
          {editor.helper}
        </IonNote>

        {(editor.kind === "base_minimum" || editor.kind === "base_km") && (
          <>
            <IonItem lines="full" style={{ marginTop: 12 }}>
              <IonLabel position="stacked">Valor CLP</IonLabel>
              <IonInput
                inputmode="numeric"
                value={editor.value}
                placeholder="Ej: 5.000"
                onIonInput={(event) => updateCurrencyFromClp(String(event.detail.value ?? ""))}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Valor USD</IonLabel>
              <IonInput
                inputmode="decimal"
                value={editor.valueUsd}
                placeholder="Ej: 5"
                onIonInput={(event) => updateCurrencyFromUsd(String(event.detail.value ?? ""))}
              />
              <IonNote slot="helper">
                Se convierte usando USD 1 = {formatClp(config.usdRate)}.
              </IonNote>
            </IonItem>
          </>
        )}

        {editor.kind === "included_km" && (
          <IonItem lines="full" style={{ marginTop: 12 }}>
            <IonLabel position="stacked">Kilómetros incluidos</IonLabel>
            <IonInput
              inputmode="decimal"
              value={editor.value}
              placeholder="Ej: 2"
              onIonInput={(event) => updateEditor({ value: String(event.detail.value ?? "") })}
            />
          </IonItem>
        )}

        {editor.kind === "rural_limit" && (
          <IonItem lines="full" style={{ marginTop: 12 }}>
            <IonLabel position="stacked">Límite zona urbana en km</IonLabel>
            <IonInput
              inputmode="decimal"
              value={editor.value}
              placeholder="Ej: 6"
              onIonInput={(event) => updateEditor({ value: String(event.detail.value ?? "") })}
            />
            <IonNote slot="helper">
              Desde 6,01 km se cobra tramo rural sobre el excedente.
            </IonNote>
          </IonItem>
        )}

        {editor.kind === "rural_discount" && (
          <IonItem lines="full" style={{ marginTop: 12 }}>
            <IonLabel position="stacked">Descuento rural (%)</IonLabel>
            <IonInput
              inputmode="decimal"
              value={editor.value}
              placeholder="Ej: 25"
              onIonInput={(event) => updateEditor({ value: String(event.detail.value ?? "") })}
            />
            <IonNote slot="helper">
              Factor actual: {formatMultiplier(1 - parseMoney(editor.value, config.rural.ruralDiscountPercent) / 100)}.
            </IonNote>
          </IonItem>
        )}

        {editor.kind === "rounding" && (
          <>
            <IonItem lines="full" style={{ marginTop: 12 }}>
              <IonLabel position="stacked">Modo de redondeo</IonLabel>
              <IonSelect
                value="ceil"
                interface="action-sheet"
                disabled
              >
                <IonSelectOption value="ceil">Múltiplo superior obligatorio</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Múltiplo CLP</IonLabel>
              <IonInput
                inputmode="numeric"
                value={editor.value}
                placeholder="Ej: 100"
                onIonInput={(event) => updateEditor({ value: String(event.detail.value ?? "") })}
              />
            </IonItem>
          </>
        )}

        {editor.kind === "usd_rate" && (
          <IonItem lines="full" style={{ marginTop: 12 }}>
            <IonLabel position="stacked">CLP por USD 1</IonLabel>
            <IonInput
              inputmode="numeric"
              value={editor.value}
              placeholder="Ej: 1.000"
              onIonInput={(event) => updateEditor({ value: String(event.detail.value ?? "") })}
            />
            <IonNote slot="helper">
              Esta tasa define cómo se muestra USD en el panel y en la app.
            </IonNote>
          </IonItem>
        )}

        {(editor.kind === "passenger" || editor.kind === "generated_variable" || editor.kind === "generated_fixed") &&
          editor.passenger && (
          <>
            <IonItem lines="full" style={{ marginTop: 12 }}>
              <IonLabel position="stacked">Multiplicador pasajero</IonLabel>
              <IonInput
                inputmode="decimal"
                value={editor.passengerMultiplier}
                placeholder="Ej: 1,13"
                onIonInput={(event) =>
                  updateEditor({ passengerMultiplier: String(event.detail.value ?? "") })
                }
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel>Estado tipo pasajero</IonLabel>
              <IonSelect
                value={editor.passengerActive ?? "yes"}
                interface="action-sheet"
                onIonChange={(event) =>
                  updateEditor({ passengerActive: String(event.detail.value ?? "yes") as "yes" | "no" })
                }
              >
                <IonSelectOption value="yes">Activo</IonSelectOption>
                <IonSelectOption value="no">Inactivo</IonSelectOption>
              </IonSelect>
            </IonItem>
          </>
        )}

        {(editor.kind === "vehicle" || editor.kind === "generated_variable") &&
          editor.vehicle && (
          <>
            <IonItem lines="full" style={{ marginTop: editor.kind === "vehicle" ? 12 : 0 }}>
              <IonLabel position="stacked">Multiplicador vehículo</IonLabel>
              <IonInput
                inputmode="decimal"
                value={editor.vehicleMultiplier}
                placeholder="Ej: 1,40"
                onIonInput={(event) =>
                  updateEditor({ vehicleMultiplier: String(event.detail.value ?? "") })
                }
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel>Estado categoría vehículo</IonLabel>
              <IonSelect
                value={editor.vehicleActive ?? "yes"}
                interface="action-sheet"
                onIonChange={(event) =>
                  updateEditor({ vehicleActive: String(event.detail.value ?? "yes") as "yes" | "no" })
                }
              >
                <IonSelectOption value="yes">Activa</IonSelectOption>
                <IonSelectOption value="no">Inactiva</IonSelectOption>
              </IonSelect>
            </IonItem>
          </>
        )}

        {editor.kind === "generated_variable" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {renderValueBlock("Resultado mínima", previewVariableMinimum)}
            {renderValueBlock("Resultado KM", previewVariableKm)}
          </div>
        )}

        {(editor.kind === "fixed_destination" || editor.kind === "generated_fixed") && (
          <>
            <IonItem lines="full" style={{ marginTop: 12 }}>
              <IonLabel position="stacked">Destino</IonLabel>
              <IonInput
                value={editor.name}
                placeholder="Ej: Anakena"
                onIonInput={(event) =>
                  updateEditor({ name: String(event.detail.value ?? "") })
                }
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Tipo de viaje</IonLabel>
              <IonInput
                value={editor.tripType}
                placeholder="Ej: Ida y vuelta"
                onIonInput={(event) =>
                  updateEditor({ tripType: String(event.detail.value ?? "") })
                }
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Tarifa base Residente Rapa Nui CLP</IonLabel>
              <IonInput
                inputmode="numeric"
                value={editor.baseResidentClp}
                placeholder="Ej: 38.000"
                onIonInput={(event) =>
                  updateFixedClp(String(event.detail.value ?? ""))
                }
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Tarifa base Residente Rapa Nui USD</IonLabel>
              <IonInput
                inputmode="decimal"
                value={editor.baseResidentUsd}
                placeholder="Ej: 38"
                onIonInput={(event) =>
                  updateFixedUsd(String(event.detail.value ?? ""))
                }
              />
              <IonNote slot="helper">
                Se convierte usando USD 1 = {formatClp(config.usdRate)}.
              </IonNote>
            </IonItem>

            <IonItem lines="full">
              <IonLabel>Estado destino</IonLabel>
              <IonSelect
                value={editor.destinationActive ?? "yes"}
                interface="action-sheet"
                onIonChange={(event) =>
                  updateEditor({ destinationActive: String(event.detail.value ?? "yes") as "yes" | "no" })
                }
              >
                <IonSelectOption value="yes">Activo</IonSelectOption>
                <IonSelectOption value="no">Inactivo</IonSelectOption>
              </IonSelect>
            </IonItem>

            {editor.kind === "generated_fixed" && fixedPreviewFinal != null && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {renderValueBlock("Tarifa final generada", fixedPreviewFinal)}
              </div>
            )}
          </>
        )}

        {error && (
          <IonText color="danger" style={{ display: "block", marginTop: 10 }}>
            <p style={{ margin: 0, fontWeight: 900 }}>{error}</p>
          </IonText>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <IonButton
            expand="block"
            color="warning"
            disabled={saving}
            onClick={() => void handleSaveEditor()}
            style={{ "--border-radius": "16px", "--color": "#111", fontWeight: 950 } as React.CSSProperties}
          >
            {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={saveOutline} slot="start" />}
            Guardar
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            color="medium"
            onClick={closeEditor}
            style={{ "--border-radius": "16px", fontWeight: 900 } as React.CSSProperties}
          >
            Cancelar
          </IonButton>
        </div>
      </>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle style={{ color: "#111", fontWeight: 950 }}>Tarifas</IonTitle>
          <IonButtons slot="end">
            <IonButton color="dark" fill="clear" onClick={() => openFixedEditor()}>
              Agregar destino
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={pageBackground}>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void load().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div style={shellStyle}>
          <IonCard style={cardStyle}>
            <IonCardContent style={{ padding: "16px" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 950, lineHeight: 1.15 }}>
                Motor de tarifas Rapa Go
              </div>
              <div style={{ marginTop: 6, fontSize: ".86rem", color: "#333", fontWeight: 800, lineHeight: 1.35 }}>
                Todo queda editable desde el panel: CLP, USD referencial, multiplicadores de Residente Rapa Nui, Turista chileno y Turista extranjero, zona urbana/rural, descuento rural, redondeo final, categorías de vehículo y destinos fijos.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <IonButton
                  size="small"
                  fill="outline"
                  color="warning"
                  onClick={restoreDefaults}
                  style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
                >
                  Restaurar esquema
                </IonButton>
                <IonButton
                  size="small"
                  fill="clear"
                  color="medium"
                  onClick={() => void load()}
                  style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
                >
                  <IonIcon icon={refreshOutline} slot="start" />
                  Actualizar
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {error && (
            <IonText color="danger" style={{ display: "block", margin: "0 0 12px" }}>
              <p style={{ margin: 0, fontWeight: 900 }}>{error}</p>
            </IonText>
          )}

          {success && (
            <IonText color="success" style={{ display: "block", margin: "0 0 12px" }}>
              <p style={{ margin: 0, fontWeight: 900 }}>{success}</p>
            </IonText>
          )}

          {!loading && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 16 }}>
                {renderParameterCard(
                  "Tarifa mínima base",
                  formatClp(config.urban.baseMinimumClp),
                  `USD ${formatUsd(config.urban.baseMinimumClp, config.usdRate)}`,
                  `Incluye los primeros ${config.urban.includedKm} km.`,
                  cashOutline,
                  () =>
                    openCurrencyEditor(
                      "base_minimum",
                      "Editar tarifa mínima base",
                      "Valor base Residente Rapa Nui para vehículo estándar.",
                      config.urban.baseMinimumClp,
                    ),
                )}

                {renderParameterCard(
                  "Tarifa por km adicional",
                  formatClp(config.urban.baseKmClp),
                  `USD ${formatUsd(config.urban.baseKmClp, config.usdRate)}`,
                  `Se aplica después de ${config.urban.includedKm} km.`,
                  speedometerOutline,
                  () =>
                    openCurrencyEditor(
                      "base_km",
                      "Editar tarifa por km adicional",
                      "Valor base por kilómetro adicional para Residente Rapa Nui estándar.",
                      config.urban.baseKmClp,
                    ),
                )}

                {renderParameterCard(
                  "Kilómetros incluidos",
                  `${formatClpInput(config.urban.includedKm)} km`,
                  "No aplica USD",
                  "Viajes hasta este tramo cobran solo tarifa mínima.",
                  mapOutline,
                  openIncludedKmEditor,
                )}

                {renderParameterCard(
                  "Límite zona urbana",
                  `${formatClpInput(config.rural.urbanLimitKm)} km`,
                  "Rural desde el excedente",
                  "Hasta este límite se calcula tarifa urbana. Sobre el excedente se aplica KM rural.",
                  mapOutline,
                  openRuralLimitEditor,
                )}

                {renderParameterCard(
                  "Descuento rural",
                  `${formatClpInput(config.rural.ruralDiscountPercent)}%`,
                  `Factor ${formatMultiplier(getRuralFactor(config))}`,
                  "Se aplica después del recargo por pasajero y categoría de vehículo.",
                  speedometerOutline,
                  openRuralDiscountEditor,
                )}

                {renderParameterCard(
                  "Regla de redondeo",
                  getRoundingLabel(config),
                  "No aplica USD",
                  "Se aplica solo al final del cálculo.",
                  refreshOutline,
                  openRoundingEditor,
                )}

                {renderParameterCard(
                  "USD referencial",
                  `${formatClp(config.usdRate)} por USD 1`,
                  "Editable",
                  "Define cómo se muestra el precio equivalente en USD.",
                  settingsOutline,
                  () =>
                    openCurrencyEditor(
                      "usd_rate",
                      "Editar USD referencial",
                      "Cantidad de CLP equivalente a USD 1.",
                      config.usdRate,
                    ),
                )}
              </div>

              <IonCard style={cardStyle}>
                <IonCardContent style={{ padding: "14px 12px 12px" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 950, marginBottom: 10 }}>
                    Tipos de pasajero
                  </div>

                  <IonList style={{ background: "transparent", padding: 0 }}>
                    {(Object.keys(PASSENGER_LABEL) as PassengerKey[]).map((key) =>
                      renderMultiplierCard(
                        PASSENGER_LABEL[key],
                        config.passengerMultipliers[key],
                        config.passengerActive[key] !== false,
                        "Se aplica a tarifa mínima, km adicional y tarifas fijas.",
                        () => openPassengerEditor(key),
                      ),
                    )}
                  </IonList>
                </IonCardContent>
              </IonCard>

              <IonCard style={cardStyle}>
                <IonCardContent style={{ padding: "14px 12px 12px" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 950, marginBottom: 10 }}>
                    Categorías de vehículo
                  </div>

                  <IonList style={{ background: "transparent", padding: 0 }}>
                    {(Object.keys(VEHICLE_LABEL) as VehicleKey[]).map((key) =>
                      renderMultiplierCard(
                        VEHICLE_LABEL[key],
                        config.vehicleMultipliers[key],
                        config.vehicleActive[key] !== false,
                        VEHICLE_DESCRIPTION[key],
                        () => openVehicleEditor(key),
                      ),
                    )}
                  </IonList>
                </IonCardContent>
              </IonCard>

              <IonCard style={cardStyle}>
                <IonCardContent style={{ padding: "14px 12px 12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: "1rem", fontWeight: 950 }}>
                      Destinos con tarifa fija
                    </div>

                    <IonButton size="small" color="warning" onClick={() => openFixedEditor()}>
                      <IonIcon icon={add} slot="start" />
                      Agregar
                    </IonButton>
                  </div>

                  <IonList style={{ background: "transparent", padding: 0 }}>
                    {config.fixedDestinations.map((destination) => (
                      <IonItem key={destination.id} lines="none" style={innerCardStyle}>
                        <div style={{ width: "100%", padding: "12px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div>
                              <strong style={{ fontSize: ".94rem" }}>{destination.title}</strong>
                              <div style={{ color: "#666", fontSize: ".75rem", marginTop: 4 }}>
                                {destination.tripType}
                              </div>
                            </div>
                            <IonBadge color={destination.active ? "success" : "medium"}>
                              {destination.active ? "Activa" : "Inactiva"}
                            </IonBadge>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                            {renderValueBlock("Residente Rapa Nui", getFixedFare(config, destination, "resident"))}
                            {renderValueBlock("Turista chileno", getFixedFare(config, destination, "chilean"))}
                            {renderValueBlock("Turista extranjero", getFixedFare(config, destination, "foreigner"))}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                            <IonButton
                              size="small"
                              color="warning"
                              onClick={() => openFixedEditor(destination)}
                              style={{ "--border-radius": "999px", "--color": "#111", fontWeight: 900 } as React.CSSProperties}
                            >
                              <IonIcon icon={createOutline} slot="start" />
                              Editar CLP/USD
                            </IonButton>

                            <IonButton
                              size="small"
                              fill="outline"
                              color={destination.active ? "medium" : "success"}
                              onClick={() => toggleFixedDestination(destination)}
                              style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
                            >
                              {destination.active ? "Desactivar" : "Activar"}
                            </IonButton>

                            <IonButton
                              size="small"
                              fill="clear"
                              color="danger"
                              onClick={() => deleteFixedDestination(destination)}
                              style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
                            >
                              <IonIcon icon={trashOutline} slot="start" />
                              Eliminar
                            </IonButton>
                          </div>
                        </div>
                      </IonItem>
                    ))}
                  </IonList>
                </IonCardContent>
              </IonCard>

              <IonCard style={cardStyle}>
                <IonCardContent style={{ padding: "14px 12px 12px" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 950, marginBottom: 10 }}>
                    Casos de prueba urbanos
                  </div>

                  <div style={{ color: "#555", fontSize: ".78rem", fontWeight: 800, marginBottom: 10 }}>
                    Vehículo estándar. Valores con redondeo aplicado solo al final.
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {standardTests.map((row) => (
                      <div
                        key={row.km}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "52px 1fr",
                          gap: 8,
                          alignItems: "center",
                          background: "#fff",
                          border: "1px solid rgba(210,164,58,.28)",
                          borderRadius: 14,
                          padding: 10,
                        }}
                      >
                        <strong>{row.km} km</strong>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", fontSize: ".78rem", fontWeight: 900 }}>
                          <span>Rapa Nui: {formatClp(row.resident)} / USD {formatUsd(row.resident, config.usdRate)}</span>
                          <span>Turista chileno: {formatClp(row.chilean)} / USD {formatUsd(row.chilean, config.usdRate)}</span>
                          <span>Turista extranjero: {formatClp(row.foreigner)} / USD {formatUsd(row.foreigner, config.usdRate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard style={cardStyle}>
                <IonCardContent style={{ padding: "14px 12px 12px" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 950, marginBottom: 10 }}>
                    Casos de prueba rurales
                  </div>

                  <div style={{ color: "#555", fontSize: ".78rem", fontWeight: 800, marginBottom: 10 }}>
                    Fórmula: KM rural = KM urbano base x pasajero x vehículo x {formatMultiplier(getRuralFactor(config))}. No se usa un KM rural único para todos.
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ruralTests.map((row) => (
                      <div
                        key={row.title}
                        style={{
                          background: "#fff",
                          border: "1px solid rgba(210,164,58,.28)",
                          borderRadius: 14,
                          padding: 10,
                        }}
                      >
                        <strong>{row.title}</strong>
                        <div style={{ color: "#555", fontSize: ".75rem", fontWeight: 800, marginTop: 3 }}>
                          {row.km} km total · {formatClpInput(row.urbanKm)} km urbanos · {formatClpInput(row.ruralKm)} km rurales
                        </div>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", fontSize: ".78rem", fontWeight: 900, marginTop: 7 }}>
                          <span>Rapa Nui: {formatClp(row.resident)} / USD {formatUsd(row.resident, config.usdRate)}</span>
                          <span>Turista chileno: {formatClp(row.chilean)} / USD {formatUsd(row.chilean, config.usdRate)}</span>
                          <span>Turista extranjero: {formatClp(row.foreigner)} / USD {formatUsd(row.foreigner, config.usdRate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard style={cardStyle}>
                <IonCardContent style={{ padding: "14px 12px 12px" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 950, marginBottom: 4 }}>
                    Tarifas generadas para la app
                  </div>

                  <div style={{ color: "#555", fontSize: ".78rem", fontWeight: 800, marginBottom: 10 }}>
                    Todas estas tarjetas son editables. Al editar una tarjeta se modifican los parámetros que la generan, manteniendo el motor tarifario.
                  </div>

                  <IonList style={{ background: "transparent", padding: 0 }}>
                    {generatedRules.map(renderGeneratedRule)}
                  </IonList>
                </IonCardContent>
              </IonCard>
            </>
          )}
        </div>

        <IonModal isOpen={editor !== null} onDidDismiss={closeEditor}>
          <IonHeader>
            <IonToolbar color="dark">
              <IonTitle>{editor?.title ?? "Editar tarifa"}</IonTitle>
              <IonButtons slot="end">
                <IonButton color="light" fill="clear" onClick={closeEditor}>
                  Cerrar
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            <IonCard style={{ ...cardStyle, boxShadow: "none" }}>
              <IonCardContent>{renderEditorContent()}</IonCardContent>
            </IonCard>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

export default AdminFareSettingsPage;
