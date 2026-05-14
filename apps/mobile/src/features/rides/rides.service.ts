import { apiClient } from "../../services/api/index.js";

type RidesEnvelope = { ok: true; data: RideRequestData[]; statusCode: number };
type RideEnvelope  = { ok: true; data: RideRequestData;   statusCode: number };

/** Ride response for passenger — includes driverUserId and acceptedAt. */
export interface RideRequestData {
  id:               string;
  passengerUserId:  string;
  driverUserId:     string | null;
  originText:       string;
  destinationText:  string;
  notes:            string | null;
  estimatedFareClp: number | null;
  status:           string;
  requestedAt:     string;
  acceptedAt:      string | null;
  startedAt:          string | null;
  completedAt:        string | null;
  cancelledAt:        string | null;
  cancellationReason: string | null;
  cancelledByRole:    string | null;
  createdAt:          string;
  updatedAt:          string;
}

/** Subset returned to drivers for their own rides. */
export interface DriverRideData {
  id:                 string;
  originText:         string;
  destinationText:    string;
  notes:              string | null;
  estimatedFareClp:   number | null;
  status:             string;
  requestedAt:        string;
  acceptedAt:         string | null;
  startedAt:          string | null;
  completedAt:        string | null;
  cancelledAt:        string | null;
  cancellationReason: string | null;
  cancelledByRole:    string | null;
  createdAt:          string;
}

/** Subset returned to drivers — no passenger identity. */
export interface AvailableRideData {
  id:               string;
  originText:       string;
  destinationText:  string;
  notes:            string | null;
  estimatedFareClp: number | null;
  status:           string;
  requestedAt:     string;
  createdAt:       string;
}

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

  async listAvailableRides(accessToken: string): Promise<AvailableRideData[]> {
    type AvailableEnvelope = { ok: true; data: AvailableRideData[]; statusCode: number };
    const result = await apiClient.get<AvailableEnvelope>("/rides/available", { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load available rides.");
    return (result.data as AvailableEnvelope).data;
  },

  async acceptRideRequest(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/accept`, {}, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to accept ride request.");
    return (result.data as RideEnvelope).data;
  },

  async completeRide(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/complete`, {}, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to complete ride.");
    return (result.data as RideEnvelope).data;
  },

  async startRide(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/start`, {}, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to start ride.");
    return (result.data as RideEnvelope).data;
  },

  async cancelAcceptedRide(accessToken: string, rideId: string, reason?: string): Promise<RideRequestData> {
    const body: { reason?: string } = {};
    if (reason) body.reason = reason;
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/cancel-accepted`, body, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to cancel ride.");
    return (result.data as RideEnvelope).data;
  },

  async listDriverRides(accessToken: string): Promise<DriverRideData[]> {
    type DriverRidesEnvelope = { ok: true; data: DriverRideData[]; statusCode: number };
    const result = await apiClient.get<DriverRidesEnvelope>("/rides/driver/me", { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load driver rides.");
    return (result.data as DriverRidesEnvelope).data;
  },
};
