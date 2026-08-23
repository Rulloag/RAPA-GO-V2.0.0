/**
 * Collares de bienvenida — solo reservas Mataveri con ≥4 h de anticipación.
 * El precio unitario y la elegibilidad se resuelven siempre en servidor.
 */

export const AIRPORT_FLOWER_LEI_UNIT_PRICE_CLP = 4000;
export const AIRPORT_FLOWER_LEI_MAX_QUANTITY = 20;
export const FLOWER_LEI_MIN_LEAD_MS = 4 * 60 * 60 * 1000;

export type FlowerLeiRejectCode =
  | "FLOWER_LEI_NOT_AIRPORT"
  | "FLOWER_LEI_NOT_SCHEDULED"
  | "FLOWER_LEI_LESS_THAN_4_HOURS"
  | "FLOWER_LEI_INVALID_QUANTITY"
  | "FLOWER_LEI_ROUND_TRIP_NOT_ALLOWED";

export type FlowerLeiEvaluation =
  | {
      requested: false;
      quantity: 0;
      surchargeClp: 0;
    }
  | {
      requested: true;
      ok: true;
      quantity: number;
      surchargeClp: number;
      leadMs: number;
      scheduledAt: string;
    }
  | {
      requested: true;
      ok: false;
      code: FlowerLeiRejectCode;
      message: string;
    };

export function isMataveriAirportOriginText(originText: unknown): boolean {
  return /mataveri|aeropuerto\s+internacional|aeropuerto\s+rapa\s+nui/i.test(
    String(originText ?? ""),
  );
}

export function isFlowerLeiLeadTimeMet(
  scheduledAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!scheduledAtIso) return false;
  const at = Date.parse(scheduledAtIso);
  if (!Number.isFinite(at)) return false;
  return at - nowMs >= FLOWER_LEI_MIN_LEAD_MS;
}

export function formatLeadTimeLabel(leadMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(leadMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} horas ${String(minutes).padStart(2, "0")} minutos`;
}

export function evaluateAirportFlowerLei(input: {
  airportWelcomeOption?: "none" | "flower_lei" | null | undefined;
  flowerLeiQuantity?: number | null | undefined;
  originText?: string | null;
  isScheduled?: boolean;
  tripFareMode?: "one_way" | "round_trip" | null;
  scheduledAt?: string | null;
  nowMs?: number;
}): FlowerLeiEvaluation {
  if (input.airportWelcomeOption !== "flower_lei") {
    return { requested: false, quantity: 0, surchargeClp: 0 };
  }

  if (!input.isScheduled) {
    return {
      requested: true,
      ok: false,
      code: "FLOWER_LEI_NOT_SCHEDULED",
      message:
        "Los collares solo están disponibles en reservas programadas desde el aeropuerto.",
    };
  }

  if (input.tripFareMode === "round_trip") {
    return {
      requested: true,
      ok: false,
      code: "FLOWER_LEI_ROUND_TRIP_NOT_ALLOWED",
      message: "Los collares no aplican a reservas de ida y vuelta promocional.",
    };
  }

  if (!isMataveriAirportOriginText(input.originText)) {
    return {
      requested: true,
      ok: false,
      code: "FLOWER_LEI_NOT_AIRPORT",
      message:
        "Los collares solo pueden solicitarse en traslados con origen en Aeropuerto Internacional Mataveri.",
    };
  }

  const scheduledAt = String(input.scheduledAt ?? "").trim();
  const nowMs = input.nowMs ?? Date.now();
  if (!isFlowerLeiLeadTimeMet(scheduledAt, nowMs)) {
    console.info(
      "[FLOWER_NECKLACE] rejected reason=LESS_THAN_4_HOURS",
    );
    return {
      requested: true,
      ok: false,
      code: "FLOWER_LEI_LESS_THAN_4_HOURS",
      message:
        "Los collares deben solicitarse con al menos 4 horas de anticipación respecto de la hora programada del traslado.",
    };
  }

  const rawQty = Number(input.flowerLeiQuantity);
  if (
    !Number.isInteger(rawQty) ||
    rawQty < 1 ||
    rawQty > AIRPORT_FLOWER_LEI_MAX_QUANTITY
  ) {
    return {
      requested: true,
      ok: false,
      code: "FLOWER_LEI_INVALID_QUANTITY",
      message: `La cantidad de collares debe ser un entero entre 1 y ${AIRPORT_FLOWER_LEI_MAX_QUANTITY}.`,
    };
  }

  const leadMs = Date.parse(scheduledAt) - nowMs;

  return {
    requested: true,
    ok: true,
    quantity: rawQty,
    surchargeClp: rawQty * AIRPORT_FLOWER_LEI_UNIT_PRICE_CLP,
    leadMs,
    scheduledAt,
  };
}

export function buildFlowerLeiNotesLines(
  evaluation: Extract<FlowerLeiEvaluation, { requested: true; ok: true }>,
): string[] {
  return [
    `RAPAGO_FLOWER_LEI_QUANTITY: ${evaluation.quantity}`,
    `RAPAGO_FLOWER_LEI_UNIT_PRICE_CLP: ${AIRPORT_FLOWER_LEI_UNIT_PRICE_CLP}`,
    `RAPAGO_FLOWER_LEI_SURCHARGE_CLP: ${evaluation.surchargeClp}`,
    `RAPAGO_FLOWER_LEI_STATUS: pending`,
    `RAPAGO_FLOWER_LEI_REQUESTED_AT: ${new Date().toISOString()}`,
    `RAPAGO_FLOWER_LEI_LEAD: ${formatLeadTimeLabel(evaluation.leadMs)}`,
    `Recibimiento aeropuerto confirmado por backend: ${evaluation.quantity} ${
      evaluation.quantity === 1 ? "collar" : "collares"
    } de flores.`,
  ];
}
