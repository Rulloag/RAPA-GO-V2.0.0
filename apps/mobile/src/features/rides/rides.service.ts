import { apiClient } from "../../services/api/index.js";

type RidesEnvelope = { ok: true; data: RideRequestData[]; statusCode: number };
type RideEnvelope  = { ok: true; data: RideRequestData;   statusCode: number };

type ApiFailureLike = {
  ok: false;
  message?: string;
  statusCode?: number;
  code?: string;
};

export type RideServiceError = Error & {
  statusCode?: number;
  code?: string;
};

function createRideServiceError(
  failure: ApiFailureLike,
  fallbackMessage: string,
): RideServiceError {
  const error = new Error(failure.message ?? fallbackMessage) as RideServiceError;
  error.statusCode = failure.statusCode;
  error.code = failure.code;
  return error;
}

type ComplianceLocationPayload = {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  capturedAt: string;
};

async function captureCancellationLocation(): Promise<ComplianceLocationPayload | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return await new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(null), 3000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : undefined,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        });
      },
      () => {
        window.clearTimeout(timeoutId);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 2500,
        maximumAge: 15000,
      },
    );
  });
}

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
  /** Foto canónica del conductor devuelta por el backend para este ride. */
  driverProfilePhotoUrl?: string | null;
  requestedVehicleCategory?: string | null;
  assignedVehicleCategory?: string | null;
  isOfflineBooking?:    boolean;
  discountApplied:      boolean;
  discountPercent:      number | null;
  originalFareClp:      number | null;
  paymentMethod?: "cash" | "card" | null;
  paymentProvider?: string | null;
  walletBenefitRequested?: boolean;
  fareBeforeWalletBenefitClp?: number | null;
  walletBenefitAppliedClp?: number;
  walletBenefitRemainingClp?: number;
  walletBenefitReversedClp?: number;
  walletBenefitReversedAt?: string | null;
  baseFareClp?: number | null;
  policyChargesAppliedClp?: number;
  /** automatic | manual | queued_offer — nunca expone datos de otro viaje del mismo conductor. */
  assignmentMode?: string;
  /** Sólo presente cuando assignmentMode === 'queued_offer': espera estimada (min), no es ETA de ruta real. */
  estimatedWaitMinutes?: number | null;
}

export interface RideRouteHistoryPoint {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  capturedAt: string;
}

export interface RideStopData {
  id: string;
  rideRequestId: string;
  stopOrder: number;
  label: string;
  lat: number;
  lng: number;
  segmentDistanceMeters: number | null;
  segmentDurationSeconds: number | null;
  segmentFareClp: number | null;
  arrivedAt: string | null;
  completedAt: string | null;
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
  rideType:           string;
  scheduledPickupAt:  string | null;
  priorityFeeClp:     number | null;
  flightNumber:       string | null;
  stops?:             RideStopData[];
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
  requestedVehicleCategory?: string | null;
  priorityFeeClp?: number | null;
}

export interface ActiveRideOfferRideData {
  id:               string;
  originText:       string;
  destinationText:  string;
  estimatedFareClp: number | null;
  distanceMeters:   number | null;
  durationSeconds:  number | null;
  rideType:         string;
  scheduledPickupAt: string | null;
  priorityFeeClp:   number | null;
  flightNumber:     string | null;
  requestedVehicleCategory?: string | null;
  /** Espera estimada (min) hasta poder iniciar este viaje — no es un ETA de ruta real, ver rideQueueMatch en el backend. */
  estimatedWaitMinutes?: number | null;
  pickupDistanceKm?:     number | null;
}

export interface ActiveRideOfferData {
  offer: {
    id:             string;
    rideRequestId:  string;
    driverUserId:   string;
    status:         string;
    offeredAt:      string;
    expiresAt:      string;
    respondedAt:    string | null;
    responseSource: string | null;
    attemptOrder:   number;
  };
  ride: ActiveRideOfferRideData;
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

export interface RideDestinationInput {
  text:  string;
  lat:   number;
  lng:   number;
  order: number;
}

export interface RideSegmentInput {
  fromOrder:       number;
  toOrder:         number;
  distanceMeters:  number;
  durationSeconds: number;
}

export interface CreateRideInput {
  originText: string;
  destinationText: string;
  notes?: string;
  estimatedFareClp?: number;
  paymentMethod?: "cash" | "card";
  paymentProvider?: "klap" | "mercadopago" | "prontopaga" | "transbank" | null;
  useWalletBenefit?: boolean;
  rideMode?: "now" | "scheduled";
  isScheduled?: boolean;
  tripFareMode?: "one_way" | "round_trip";
  scheduledAt?: string | null;
  scheduledPickupAt?: string | null;
  scheduledReturnAt?: string | null;
  scheduledActivationAt?: string | null;
  scheduledReturnActivationAt?: string | null;
  airportWelcomeOption?: "none" | "flower_lei";
  flowerLeiQuantity?: number | null;
  requestedVehicleCategory?:
    | "standard"
    | "xl"
    | "extra_luggage"
    | "comfort"
    | "luggage";
  vehicleCategory?:
    | "standard"
    | "xl"
    | "extra_luggage"
    | "comfort"
    | "luggage";
  fareVehicleCategory?:
    | "standard"
    | "xl"
    | "extra_luggage"
    | "comfort"
    | "luggage";
}

export const ridesService = {
  async listMyRides(accessToken: string): Promise<RideRequestData[]> {
    const result = await apiClient.get<RidesEnvelope>("/rides/me", { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to load rides.");
    return (result.data as RidesEnvelope).data;
  },

  async getRideRouteHistory(
    accessToken: string,
    rideId: string,
  ): Promise<RideRouteHistoryPoint[]> {
    type Envelope = {
      ok: true;
      data: { rideId: string; points: RideRouteHistoryPoint[] };
      statusCode: number;
    };
    const result = await apiClient.get<Envelope>(
      `/rides/${rideId}/route-history`,
      { token: accessToken },
    );
    if (result.ok === false) {
      throw new Error(result.message ?? "Failed to load ride route history.");
    }
    return (result.data as Envelope).data.points;
  },

  async createRideRequest(accessToken: string, input: CreateRideInput): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>("/rides/request", input, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to create ride request.");
    return (result.data as RideEnvelope).data;
  },

  async cancelRideRequest(accessToken: string, rideId: string, reason?: string): Promise<RideRequestData> {
    const body: { reason?: string } = {};
    if (reason) body.reason = reason;
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/cancel`, body, { token: accessToken });
    if (result.ok === false) {
      throw createRideServiceError(
        result as unknown as ApiFailureLike,
        "Failed to cancel ride request.",
      );
    }
    return (result.data as RideEnvelope).data;
  },

  async listAvailableRides(accessToken: string): Promise<AvailableRideData[]> {
    type AvailableEnvelope = { ok: true; data: AvailableRideData[]; statusCode: number };
    const result = await apiClient.get<AvailableEnvelope>("/rides/available", { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to load available rides.");
    return (result.data as AvailableEnvelope).data;
  },

  async acceptRideRequest(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/accept`, {}, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to accept ride request.");
    return (result.data as RideEnvelope).data;
  },

  async completeRide(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/complete`, {}, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to complete ride.");
    return (result.data as RideEnvelope).data;
  },

  async markEnRoute(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/en-route`, {}, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to mark ride en-route.");
    return (result.data as RideEnvelope).data;
  },

  async markArrived(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/arrived`, {}, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to mark arrival.");
    return (result.data as RideEnvelope).data;
  },

  async startRide(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/start`, {}, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to start ride.");
    return (result.data as RideEnvelope).data;
  },

  async cancelAcceptedRide(accessToken: string, rideId: string, reason?: string): Promise<RideRequestData> {
    const body: {
      reason?: string;
      cancellationEvent: string;
      location?: ComplianceLocationPayload;
    } = {
      cancellationEvent: "mobile_cancel_accepted",
    };
    if (reason) body.reason = reason;

    const location = await captureCancellationLocation();
    if (location) body.location = location;

    const result = await apiClient.post<RideEnvelope>(`/rides/${rideId}/cancel-accepted`, body, { token: accessToken });
    if (result.ok === false) {
      throw createRideServiceError(
        result as unknown as ApiFailureLike,
        "Failed to cancel ride.",
      );
    }
    return (result.data as RideEnvelope).data;
  },

  async listDriverRides(accessToken: string): Promise<DriverRideData[]> {
    type DriverRidesEnvelope = { ok: true; data: DriverRideData[]; statusCode: number };
    const result = await apiClient.get<DriverRidesEnvelope>("/rides/driver/me", { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to load driver rides.");
    return (result.data as DriverRidesEnvelope).data;
  },

  async getActiveDriverOffer(accessToken: string): Promise<ActiveRideOfferData | null> {
    type Envelope = { ok: true; data: ActiveRideOfferData | null; statusCode: number };
    const result = await apiClient.get<Envelope>("/drivers/me/offers/active", { token: accessToken });
    if (!result.ok) return null;
    return (result.data as Envelope).data;
  },

  async acceptDriverOffer(accessToken: string, offerId: string): Promise<RideRequestData> {
    const result = await apiClient.post<RideEnvelope>(`/drivers/me/offers/${offerId}/accept`, {}, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Error al aceptar oferta.");
    return (result.data as RideEnvelope).data;
  },

  async rejectDriverOffer(accessToken: string, offerId: string): Promise<void> {
    const result = await apiClient.post<{ ok: true; data: { rejected: boolean }; statusCode: number }>(
      `/drivers/me/offers/${offerId}/reject`, {}, { token: accessToken },
    );
    if (result.ok === false) throw new Error(result.message ?? "Error al rechazar oferta.");
  },

  async acceptAnyDriver(accessToken: string, rideId: string): Promise<RideRequestData> {
    const result = await apiClient.patch<RideEnvelope>(`/rides/${rideId}/accept-any-driver`, {}, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to accept any driver.");
    return (result.data as RideEnvelope).data;
  },

  async rateRide(accessToken: string, rideId: string, rating: number, comment?: string): Promise<RatingData> {
    type RatingEnvelope = { ok: true; data: RatingData; statusCode: number };
    const body: { rating: number; comment?: string } = { rating };
    if (comment) body.comment = comment;
    const result = await apiClient.post<RatingEnvelope>(`/rides/${rideId}/rate`, body, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to submit rating.");
    return (result.data as RatingEnvelope).data;
  },
};
