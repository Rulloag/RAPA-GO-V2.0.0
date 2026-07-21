function parseOptionalBoolean(value: unknown): boolean | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

const isProduction = process.env["NODE_ENV"] === "production";
const allowFutureFeaturesInProduction =
  parseOptionalBoolean(process.env["ALLOW_FUTURE_FEATURES_IN_PRODUCTION"]) === true;

function featureEnabled(key: string): boolean {
  const explicit = parseOptionalBoolean(process.env[key]);

  // Desarrollo y tests mantienen compatibilidad salvo que el flag sea false.
  if (!isProduction) return explicit ?? true;

  // Producción niega por defecto y exige doble habilitación deliberada.
  return explicit === true && allowFutureFeaturesInProduction;
}

export const releaseFeatures = {
  tourism: featureEnabled("FEATURE_TOURISM_ENABLED"),
  rentals: featureEnabled("FEATURE_RENTALS_ENABLED"),
  events: featureEnabled("FEATURE_EVENTS_ENABLED"),
} as const;

export function isApplicationTypeEnabled(
  type: "driver" | "guide" | "rental_operator",
): boolean {
  if (type === "guide") return releaseFeatures.tourism;
  if (type === "rental_operator") return releaseFeatures.rentals;
  return true;
}
