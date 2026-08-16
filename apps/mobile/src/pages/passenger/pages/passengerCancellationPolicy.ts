/**
 * Reloj de cancelación del pasajero. Debe coincidir con
 * `shouldCreatePassengerCancellationCharge` en apps/api rides.service.ts:
 *
 * - queued_offer + accepted → siempre gratis (el conductor aún termina otro viaje)
 * - queued_offer ya activado → el minuto de cortesía arranca en enRouteAt
 * - viajes normales → el minuto de cortesía arranca en acceptedAt
 */

export const PASSENGER_FREE_CANCELLATION_MS = 1 * 60 * 1000;

export function parsePassengerPolicyTimestampMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPassengerQueuedOfferAssignment(assignmentMode: unknown): boolean {
  return String(assignmentMode ?? "").trim() === "queued_offer";
}

/**
 * Mientras B sigue en cola (o accepted sin enRouteAt), backend cobra $0.
 * El 30% / $3.000 no aplica hasta que el conductor arranca hacia B.
 */
export function isPassengerQueuedOfferFreeCancel(input: {
  assignmentMode?: unknown;
  status?: unknown;
  enRouteAt?: unknown;
}): boolean {
  if (!isPassengerQueuedOfferAssignment(input.assignmentMode)) return false;

  const status = String(input.status ?? "").trim().toLowerCase();
  if (status === "accepted") return true;

  return parsePassengerPolicyTimestampMs(input.enRouteAt) == null;
}

/**
 * Inicio del reloj de 1 minuto. `acceptedAtMs` sólo se usa en viajes no encadenados;
 * en queued_offer se ignora a propósito (puede ser minutos anterior a enRouteAt).
 */
export function getPassengerCancellationPolicyClockStartMs(input: {
  assignmentMode?: unknown;
  status?: unknown;
  acceptedAtMs?: number | null;
  enRouteAt?: unknown;
}): number | null {
  if (isPassengerQueuedOfferAssignment(input.assignmentMode)) {
    const status = String(input.status ?? "").trim().toLowerCase();
    if (status === "accepted") return null;
    return parsePassengerPolicyTimestampMs(input.enRouteAt);
  }

  const acceptedAtMs = input.acceptedAtMs;
  if (acceptedAtMs == null || !Number.isFinite(acceptedAtMs)) return null;
  return acceptedAtMs;
}
