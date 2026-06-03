import { apiClient } from "../../services/api/index.js";

type RidesEnvelope = { ok: true; data: RideRequestData[]; statusCode: number };
type RideEnvelope  = { ok: true; data: RideRequestData;   statusCode: number };

/** Ride response for passenger — includes driverUserId and acceptedAt. */
export interface RideRequestData {
  id:               string;
  passengerUserId:  string;
  driverUserId:     string | null;
  driverName:       string | null;
  driverPhone:      string | null;
  originText:       string;
  destinationText:  string;
  notes:            string | null;
  estimatedFareClp: number | null;
  originLat:        number | null;
  originLng:        number | null;
  destinationLat:   number | null;
  destinationLng:   number | null;
  distanceMeters:   number | null;
  durationSeconds:  number | null;
  status:           string;
  requestedAt:     string;
  acceptedAt:      string | null;
  enRouteAt:          string | null;
  arrivedAt:          string | null;
  startedAt:          string | null;
  completedAt:        string | null;
  cancelledAt:        string | null;
  cancellationReason: string | null;
  cancelledByRole:    string | null;
  createdAt:          string;
  updatedAt:          string;
  driverRatingAverage:  number | null;
  driverRatingCount:    number;
  driverVehicleBrand:   string | null;
  driverVehicleModel:   string | null;
  driverVehicleYear:    number | null;
  driverVehiclePlate:   string | null;
  driverVehicleColor:   string | null;
  isOfflineBooking?:    boolean;
  discountApplied:      boolean;
  discountPercent:      number | null;
  originalFareClp:      number | null;
}

/** Subset returned to drivers for their own rides. */
export interface DriverRideData {
  id:                 string;
  originText:         string;
  destinationText:    string;
  notes:              string | null;
  estimatedFareClp:   number | null;
  originLat:          number | null;
  originLng:          number | null;
  destinationLat:     number | null;
  destinationLng:     number | null;
  status:             string;
  requestedAt:        string;
  acceptedAt:         string | null;
  enRouteAt:          string | null;
  arrivedAt:          string | null;
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

export interface RatingData {
  id:            string;
  rideRequestId: string;
  raterUserId:   string;
  ratedUserId:   string;
  raterRole:     string;
  rating:        number;
  comment:       string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateRideInput {
  originText:      string;
  destinationText: string;
  originLat:       number;
  originLng:       number;
  destinationLat:  number;
  destinationLng:  number;
  distanceMeters:  number;
  durationSeconds: number;
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

  async markEnRoute(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/en-route`, {}, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to mark ride en-route.");
    return (result.data as RideEnvelope).data;
  },

  async markArrived(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/arrived`, {}, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to mark arrival.");
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

  async getDriverLocation(accessToken: string, rideId: string): Promise<{ driverUserId: string; lat: number; lng: number; updatedAt: string | null } | null> {
    type Envelope = { ok: true; data: { location: { driverUserId: string; lat: number; lng: number; updatedAt: string | null } | null }; statusCode: number };
    const result = await apiClient.get<Envelope>(`/rides/${rideId}/driver-location`, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to get driver location.");
    return (result.data as Envelope).data.location;
  },

  async updateDriverLocation(accessToken: string, lat: number, lng: number): Promise<{ updatedAt: string }> {
    type Envelope = { ok: true; data: { updatedAt: string }; statusCode: number };
    const result = await apiClient.patch<Envelope>("/drivers/me/location", { lat, lng }, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to update location.");
    return (result.data as Envelope).data;
  },

  async rateRide(accessToken: string, rideId: string, rating: number, comment?: string): Promise<RatingData> {
    type RatingEnvelope = { ok: true; data: RatingData; statusCode: number };
    const body: { rating: number; comment?: string } = { rating };
    if (comment) body.comment = comment;
    const result = await apiClient.post<RatingEnvelope>(`/rides/${rideId}/rate`, body, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to submit rating.");
    return (result.data as RatingEnvelope).data;
  },
};
