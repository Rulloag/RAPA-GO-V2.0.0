/**
 * Reglas financieras oficiales de RAPA GO.
 *
 * Este módulo es puro para que la política pueda probarse sin base de datos:
 * - tarifa final redondeada hacia arriba a múltiplos de $500 CLP;
 * - cancelación inmediata gratuita durante 2 minutos;
 * - reserva gratuita hasta 30 minutos antes;
 * - cancelación tardía 30%, tope $3.000;
 * - No Show después de 5 minutos, 50%, tope $5.000.
 */

export const RIDE_FARE_ROUNDING_UNIT_CLP = 500;
export const PASSENGER_FREE_CANCELLATION_MS = 2 * 60 * 1000;
export const SCHEDULED_CANCELLATION_CHARGE_WINDOW_MS =
  30 * 60 * 1000;
export const DRIVER_NO_SHOW_WAIT_MS = 5 * 60 * 1000;

export const LATE_CANCELLATION_PERCENT = 30;
export const LATE_CANCELLATION_CAP_CLP = 3000;
export const NO_SHOW_PERCENT = 50;
export const NO_SHOW_CAP_CLP = 5000;
export const NO_SHOW_DRIVER_SHARE_PERCENT = 50;
export const NO_SHOW_PLATFORM_SHARE_PERCENT = 50;

export function roundFareUpTo500(value: number): number {
  const safe = Number.isFinite(value)
    ? Math.max(0, Number(value))
    : 0;

  return (
    Math.ceil(safe / RIDE_FARE_ROUNDING_UNIT_CLP) *
    RIDE_FARE_ROUNDING_UNIT_CLP
  );
}

export type NoShowDistribution = {
  totalAmountClp: number;
  driverShareClp: number;
  platformShareClp: number;
  driverSharePercent: number;
  platformSharePercent: number;
};

/**
 * Divide el cargo No Show aprobado entre conductor y Rapa Go.
 * Si el total fuera impar, el peso indivisible queda en la parte de Rapa Go
 * para que la suma siempre coincida exactamente con el cargo total.
 */
export function splitNoShowAmount(
  amountClp: number,
): NoShowDistribution {
  const totalAmountClp = Math.max(
    0,
    Math.round(Number(amountClp) || 0),
  );

  const driverShareClp = Math.floor(
    totalAmountClp *
      (NO_SHOW_DRIVER_SHARE_PERCENT / 100),
  );

  return {
    totalAmountClp,
    driverShareClp,
    platformShareClp: totalAmountClp - driverShareClp,
    driverSharePercent: NO_SHOW_DRIVER_SHARE_PERCENT,
    platformSharePercent: NO_SHOW_PLATFORM_SHARE_PERCENT,
  };
}

export function calculateRidePolicyAmount(
  applicableFareClp: number,
  percent: number,
  capClp: number,
): number {
  const safeFare = Math.max(
    0,
    Math.round(Number(applicableFareClp) || 0),
  );

  const safePercent = Math.min(
    100,
    Math.max(0, Number(percent) || 0),
  );

  const safeCap = Math.max(
    0,
    Math.round(Number(capClp) || 0),
  );

  return Math.min(
    safeCap,
    Math.max(0, Math.round(safeFare * (safePercent / 100))),
  );
}

export function isPassengerCancellationChargeable(input: {
  isScheduled: boolean;
  scheduledPickupAtMs: number | null;
  acceptedAtMs: number | null;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();

  if (
    input.isScheduled &&
    input.scheduledPickupAtMs != null &&
    Number.isFinite(input.scheduledPickupAtMs)
  ) {
    return (
      input.scheduledPickupAtMs - nowMs <=
      SCHEDULED_CANCELLATION_CHARGE_WINDOW_MS
    );
  }

  if (
    input.isScheduled ||
    input.acceptedAtMs == null ||
    !Number.isFinite(input.acceptedAtMs)
  ) {
    return false;
  }

  return (
    nowMs - input.acceptedAtMs >=
    PASSENGER_FREE_CANCELLATION_MS
  );
}
