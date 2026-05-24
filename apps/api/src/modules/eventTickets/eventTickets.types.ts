export interface EventTicketResponse {
  id: string; userId: string; externalEventId: string; externalBookingId: string;
  eventName: string; eventDate: string | null; eventLocation: string | null;
  ticketCode: string; qrData: string; status: string;
  validatedAt: string | null; validatedBy: string | null;
  createdAt: string; updatedAt: string;
}

export type EventTicketResult =
  | { ok: true; ticket: EventTicketResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type EventTicketsResult =
  | { ok: true; items: EventTicketResponse[]; total: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type ValidateTicketResult =
  | { ok: true; id: string; status: string; validatedAt: string; message: string }
  | { ok: false; code: string; message: string; statusCode: number };
