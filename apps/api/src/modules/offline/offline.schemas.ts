import { z } from "zod";

export const createOfflineBookingSchema = z.object({
  passengerName:    z.string().trim().min(2).max(120),
  passengerPhone:   z.string().trim().min(6).max(30),
  originText:       z.string().trim().min(2).max(150),
  destinationText:  z.string().trim().min(2).max(150),
  assignedDriverId: z.string().uuid().optional(),
  notes:            z.string().trim().max(500).optional(),
});
export type CreateOfflineBookingInput = z.infer<typeof createOfflineBookingSchema>;

export const syncOfflineBookingSchema = z.object({
  rideRequestId: z.string().uuid(),
});
export type SyncOfflineBookingInput = z.infer<typeof syncOfflineBookingSchema>;

export const listOfflineBookingsQuerySchema = z.object({
  status: z.enum(["pending_sync", "synced", "cancelled"]).optional(),
});
export type ListOfflineBookingsQuery = z.infer<typeof listOfflineBookingsQuerySchema>;

export const connectivityCheckSchema = z.object({
  hadConnectivity: z.boolean(),
  locationZone:    z.string().trim().max(50).optional(),
});
export type ConnectivityCheckInput = z.infer<typeof connectivityCheckSchema>;

export const confirmSyncItemSchema = z.object({
  success:    z.boolean(),
  syncError:  z.string().trim().max(500).optional(),
});
export type ConfirmSyncItemInput = z.infer<typeof confirmSyncItemSchema>;

export const createOfflineBookingWithEmailSchema = createOfflineBookingSchema.extend({
  passengerEmail: z.string().email().optional(),
});
export type CreateOfflineBookingWithEmailInput = z.infer<typeof createOfflineBookingWithEmailSchema>;
