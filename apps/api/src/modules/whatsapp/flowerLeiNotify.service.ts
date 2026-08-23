import {
  AIRPORT_FLOWER_LEI_UNIT_PRICE_CLP,
  formatLeadTimeLabel,
} from "../rides/airportFlowerLei.js";
import {
  resolveOpsWhatsAppE164,
  sendWhatsAppText,
} from "./whatsappSend.service.js";

function formatChileDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "Pacific/Easter",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatChileTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "Pacific/Easter",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function buildFlowerLeiOpsWhatsAppBody(input: {
  reservationId: string;
  passengerName: string;
  passengerPhone?: string | null;
  passengerEmail?: string | null;
  passengerCount?: number | null;
  flowerLeiQuantity: number;
  unitPriceClp?: number;
  surchargeClp?: number;
  requestedVehicleCategory?: string | null;
  scheduledAt: string;
  leadMs: number;
  originText: string;
  destinationText: string;
  adminPath?: string | null;
}): string {
  const shortId = input.reservationId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const phone =
    String(input.passengerPhone ?? "").trim() ||
    "(sin teléfono en perfil)";
  const passengers =
    input.passengerCount != null && input.passengerCount > 0
      ? String(input.passengerCount)
      : "—";
  const unit =
    input.unitPriceClp ?? AIRPORT_FLOWER_LEI_UNIT_PRICE_CLP;
  const surcharge =
    input.surchargeClp ?? input.flowerLeiQuantity * unit;
  const category =
    String(input.requestedVehicleCategory ?? "").trim() || "standard";

  const lines = [
    "🌺 *NUEVA RESERVA CON COLLARES — RAPA GO*",
    "",
    `*Reserva:* #RG-${shortId}`,
    "",
    `*Pasajero:* ${input.passengerName}`,
    `*Teléfono:* ${phone}`,
    `*Correo:* ${input.passengerEmail ?? "—"}`,
    `*Cantidad de pasajeros:* ${passengers}`,
    `*Categoría de vehículo:* ${category}`,
    "",
    `*¿Incluye collares?:* Sí`,
    `*Cantidad de collares:* ${input.flowerLeiQuantity}`,
    `*Precio unitario:* $${unit.toLocaleString("es-CL")} CLP`,
    `*Recargo collares:* $${surcharge.toLocaleString("es-CL")} CLP (${input.flowerLeiQuantity} × $${unit.toLocaleString("es-CL")})`,
    "",
    `📅 *Fecha:* ${formatChileDate(input.scheduledAt)}`,
    `🕐 *Hora del traslado:* ${formatChileTime(input.scheduledAt)}`,
    "",
    `✈️ *Origen:* ${input.originText}`,
    `🏨 *Destino:* ${input.destinationText}`,
    "",
    `*Solicitud realizada con:* ${formatLeadTimeLabel(input.leadMs)} de anticipación.`,
    "",
    "La reserva queda en el panel del administrador y se ofrece automáticamente a conductores disponibles con esa categoría cuando entra la ventana operativa.",
  ];

  if (input.adminPath) {
    lines.push("", `Panel: ${input.adminPath}`);
  }

  return lines.join("\n");
}

export async function notifyFlowerLeiReservation(input: {
  reservationId: string;
  passengerName: string;
  passengerPhone?: string | null;
  passengerEmail?: string | null;
  passengerCount?: number | null;
  flowerLeiQuantity: number;
  unitPriceClp?: number;
  surchargeClp?: number;
  requestedVehicleCategory?: string | null;
  scheduledAt: string;
  leadMs: number;
  originText: string;
  destinationText: string;
  adminPath?: string | null;
}): Promise<void> {
  const body = buildFlowerLeiOpsWhatsAppBody(input);

  await sendWhatsAppText({
    toE164: resolveOpsWhatsAppE164(),
    body,
    rideId: input.reservationId,
  });
}
