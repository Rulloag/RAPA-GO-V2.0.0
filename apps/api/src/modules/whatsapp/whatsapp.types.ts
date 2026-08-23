// ── Literal unions ────────────────────────────────────────────────────────────

export type WaDirection   = "incoming" | "outgoing";
export type WaMessageType = "text" | "template" | "interactive" | "location" | "status";
export type WaStatus      = "queued" | "sent" | "delivered" | "read" | "failed" | "received";
export type WaIntent      = "estado" | "ubicacion" | "cancelar" | "soporte" | "precio" | "unknown";

// ── Template building blocks ──────────────────────────────────────────────────

export interface WaTextParam {
  type: "text";
  text: string;
}

export interface WaTemplateComponent {
  type:       "body" | "header" | "button";
  parameters: WaTextParam[];
}

// ── Send / receive results ────────────────────────────────────────────────────

export interface WaSendResult {
  ok:                 boolean;
  providerMessageId?: string | undefined;
  error?:             string;
  errorCode?:         string;
}

// ── Incoming payload shapes (Meta Cloud API v20) ──────────────────────────────

export interface WaIncomingText {
  body: string;
}

export interface WaIncomingMessage {
  from:       string;       // phone without leading +  e.g. "56912345678"
  id:         string;       // wamid.xxx
  timestamp:  string;
  type:       string;
  text?:      WaIncomingText;
}

export interface WaStatusCallback {
  id:          string;      // provider_message_id
  status:      string;      // "sent" | "delivered" | "read" | "failed"
  timestamp:   string;
  recipient_id:string;
  errors?:     Array<{ code: number; title: string }>;
}

export interface WaWebhookValue {
  messaging_product: "whatsapp";
  metadata?:         { display_phone_number: string; phone_number_id: string };
  messages?:         WaIncomingMessage[];
  statuses?:         WaStatusCallback[];
}

export interface WaWebhookChange {
  value:  WaWebhookValue;
  field:  string;
}

export interface WaWebhookEntry {
  id:      string;
  changes: WaWebhookChange[];
}

export interface WaWebhookPayload {
  object:  "whatsapp_business_account";
  entry:   WaWebhookEntry[];
}

// ── Repository input ──────────────────────────────────────────────────────────

export interface CreateWaMessageInput {
  userId?:            string | undefined;
  rideId?:            string | undefined;
  phoneE164:          string;
  direction:          WaDirection;
  messageType:        WaMessageType;
  providerMessageId?: string | undefined;
  templateName?:      string;
  bodyPreview?:       string;
  status:             WaStatus;
  payloadJson?:       unknown;
  errorCode?:         string;
  errorMessage?:      string;
}
