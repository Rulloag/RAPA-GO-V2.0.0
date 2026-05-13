import { apiClient } from "../../services/api/index.js";

export interface RideRequestData {
  id:              string;
  passengerUserId: string;
  originText:      string;
  destinationText: string;
  notes:           string | null;
  status:          string;
  requestedAt:     string;
  cancelledAt:     string | null;
  createdAt:       string;
  updatedAt:       string;
}

type RidesEnvelope = { ok: true; data: RideRequestData[]; statusCode: number };
type RideEnvelope  = { ok: true; data: RideRequestData;   statusCode: number };

export interface CreateRideInput {
  originText:      string;
  destinationText: string;
  notes?:          string;
}

export const ridesService = {
  async listMyRides(accessToken: string): Promise<RideRequestData[]> {
    const result = await apiClient.get<RidesEnvelope>("/rides/me", { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load rides.");
    return (result.data as RidesEnvelope).data;
  },

  async createRideRequest(accessToken: string, input: CreateRideInput): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>("/rides/request", input, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to create ride request.");
    return (result.data as RideEnvelope).data;
  },

  async cancelRideRequest(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/cancel`, {}, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to cancel ride request.");
    return (result.data as RideEnvelope).data;
  },
};
