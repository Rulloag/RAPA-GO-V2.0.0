import { apiClient } from "../../services/api/index.js";

export interface OfflineBooking {
  id:               string;
  adminId:          string | null;
  passengerName:    string;
  passengerPhone:   string;
  originText:       string;
  destinationText:  string;
  assignedDriverId: string | null;
  status:           "pending_sync" | "synced" | "cancelled";
  notes:            string | null;
  createdAt:        string;
  syncedToRideId:   string | null;
}

export interface CreateOfflineBookingInput {
  passengerName:    string;
  passengerPhone:   string;
  originText:       string;
  destinationText:  string;
  assignedDriverId?: string;
  notes?:           string;
}

type BookingEnvelope  = { ok: true; data: OfflineBooking;   statusCode: number };
type BookingsEnvelope = { ok: true; data: OfflineBooking[]; statusCode: number };

export const offlineService = {
  async createOfflineBooking(accessToken: string, input: CreateOfflineBookingInput): Promise<OfflineBooking> {
    const result = await apiClient.post<BookingEnvelope>("/admin/offline-bookings", input, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to create offline booking.");
    return (result.data as BookingEnvelope).data;
  },

  async listOfflineBookings(accessToken: string, status?: string): Promise<OfflineBooking[]> {
    const url = status ? `/admin/offline-bookings?status=${status}` : "/admin/offline-bookings";
    const result = await apiClient.get<BookingsEnvelope>(url, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load offline bookings.");
    return (result.data as BookingsEnvelope).data;
  },

  async syncOfflineBooking(accessToken: string, id: string, rideRequestId: string): Promise<OfflineBooking> {
    const result = await apiClient.patch<BookingEnvelope>(`/admin/offline-bookings/${id}/sync`, { rideRequestId }, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to sync offline booking.");
    return (result.data as BookingEnvelope).data;
  },

  async cancelOfflineBooking(accessToken: string, id: string): Promise<OfflineBooking> {
    const result = await apiClient.patch<BookingEnvelope>(`/admin/offline-bookings/${id}/cancel`, {}, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to cancel offline booking.");
    return (result.data as BookingEnvelope).data;
  },

  async logConnectivity(accessToken: string, hadConnectivity: boolean, locationZone?: string): Promise<void> {
    await apiClient.post("/connectivity-check", { hadConnectivity, locationZone }, { token: accessToken });
  },
};
