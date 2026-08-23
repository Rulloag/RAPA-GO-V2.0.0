import { env } from "../../config/env.js";
import { RAPAGO_CONTACT } from "@rapa-go/shared";
import { WhatsappRepository } from "./whatsapp.repository.js";
import type { WaSendResult } from "./whatsapp.types.js";

const waRepo = new WhatsappRepository();

function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("56")) return digits;
  if (digits.startsWith("9") && digits.length === 9) return `56${digits}`;
  return digits;
}

/**
 * Envía un texto por WhatsApp Cloud API (si está habilitado).
 * Nunca lanza: falla → { ok: false }.
 */
export async function sendWhatsAppText(input: {
  toE164: string;
  body: string;
  userId?: string;
  rideId?: string;
}): Promise<WaSendResult> {
  const to = normalizeE164(input.toE164);
  if (!to) {
    return { ok: false, error: "missing_recipient", errorCode: "NO_PHONE" };
  }

  const preview = input.body.slice(0, 500);

  if (!env.whatsapp.enabled) {
    const queued = await waRepo.createMessage({
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.rideId !== undefined ? { rideId: input.rideId } : {}),
      phoneE164: to,
      direction: "outgoing",
      messageType: "text",
      bodyPreview: preview,
      status: "queued",
      payloadJson: { mode: "disabled", body: input.body },
    });
    console.info(
      `[WHATSAPP] notification_queued reservationId=${input.rideId ?? "n/a"} messageId=${queued.id}`,
    );
    return { ok: true, providerMessageId: queued.id };
  }

  try {
    const url = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: input.body },
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number };
    };

    if (!response.ok) {
      const errorMessage =
        payload.error?.message ?? `HTTP ${response.status}`;
      const errorCode = String(payload.error?.code ?? response.status);
      await waRepo.createMessage({
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.rideId !== undefined ? { rideId: input.rideId } : {}),
        phoneE164: to,
        direction: "outgoing",
        messageType: "text",
        bodyPreview: preview,
        status: "failed",
        payloadJson: payload,
        errorCode,
        errorMessage,
      });
      console.info(
        `[WHATSAPP] notification_failed reservationId=${input.rideId ?? "n/a"}`,
      );
      return { ok: false, error: errorMessage, errorCode };
    }

    const providerMessageId = payload.messages?.[0]?.id ?? null;
    await waRepo.createMessage({
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.rideId !== undefined ? { rideId: input.rideId } : {}),
      phoneE164: to,
      direction: "outgoing",
      messageType: "text",
      ...(providerMessageId != null ? { providerMessageId } : {}),
      bodyPreview: preview,
      status: "sent",
      payloadJson: payload,
    });
    console.info(
      `[WHATSAPP] notification_sent reservationId=${input.rideId ?? "n/a"}`,
    );
    return providerMessageId != null ? { ok: true, providerMessageId } : { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await waRepo.createMessage({
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.rideId !== undefined ? { rideId: input.rideId } : {}),
      phoneE164: to,
      direction: "outgoing",
      messageType: "text",
      bodyPreview: preview,
      status: "failed",
      errorCode: "SEND_EXCEPTION",
      errorMessage: message.slice(0, 400),
    });
    console.info(
      `[WHATSAPP] notification_failed reservationId=${input.rideId ?? "n/a"}`,
    );
    return { ok: false, error: message, errorCode: "SEND_EXCEPTION" };
  }
}

export function resolveOpsWhatsAppE164(): string {
  const fromEnv = String(process.env["WHATSAPP_OPS_E164"] ?? "").trim();
  if (fromEnv) return normalizeE164(fromEnv);
  return normalizeE164(RAPAGO_CONTACT.adminPhone);
}
