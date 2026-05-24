import { z } from "zod";

export const createTicketSchema = z.object({
  externalEventId:   z.string().min(1),
  externalBookingId: z.string().min(1),
  eventName:         z.string().min(1),
  eventDate:         z.string().optional(),
  eventLocation:     z.string().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const validateTicketSchema = z.object({
  notes: z.string().optional(),
});
export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;
