import { z } from "zod";

export const rideReceiptIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const rideReceiptRideParamsSchema = z.object({
  rideId: z.string().uuid(),
});
