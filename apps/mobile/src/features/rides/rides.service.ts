import { apiClient } from "../../services/api/index.js";

type RidesEnvelope = { ok: true; data: RideRequestData[]; statusCode: number };
type RideEnvelope  = { ok: true; data: RideRequestData;   statusCode: number };

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
  commentVisibility?: "participants_and_admin" | "admin_only";
  moderationStatus?: "visible" | "hidden";
  createdAt:     string;
  updatedAt:     string;
}

export interface CashPaymentClosureData {
  id: string;
  rideRequestId: string;
  passengerUserId: string;
  driverUserId: string;
  fareClp: number;
  paidClp: number;
  overpaidClp: number;
  decision: "exact" | "overpaid";
  status: string;
  resolutionType: "benefit" | "bank_refund" | null;
  resolutionReferenceId: string | null;
  driverNote: string | null;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRideInput {
  originText: string;
  destinationText: string;
  notes?: string;
  estimatedFareClp?: number;
  paymentMethod?: "cash" | "card";
  paymentProvider?: "mercadopago" | "prontopaga" | "transbank" | null;
  useWalletBenefit?: boolean;
  rideMode?: "now" | "scheduled";
  isScheduled?: boolean;
  tripFareMode?: "one_way" | "round_trip";
  scheduledAt?: string | null;
  scheduledPickupAt?: string | null;
  scheduledReturnAt?: string | null;
  scheduledActivationAt?: string | null;
  scheduledReturnActivationAt?: string | null;
}

export const ridesService = {
  async listMyRides(accessToken: string): Promise<RideRequestData[]> {
    const result = await apiClient.get<RidesEnvelope>("/rides/me", { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to load rides.");
    return (result.data as RidesEnvelope).data;
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
    if (result.ok === false) throw new Error(result.message ?? "Failed to cancel ride request.");
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
    if (result.ok === false) throw new Error(result.message ?? "Failed to cancel ride.");
    return (result.data as RideEnvelope).data;
  },

  async listDriverRides(accessToken: string): Promise<DriverRideData[]> {
    type DriverRidesEnvelope = { ok: true; data: DriverRideData[]; statusCode: number };
    const result = await apiClient.get<DriverRidesEnvelope>("/rides/driver/me", { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to load driver rides.");
    return (result.data as DriverRidesEnvelope).data;
  },

  async rateRide(
    accessToken: string,
    rideId: string,
    rating: number,
    comment?: string,
    commentVisibility: "participants_and_admin" | "admin_only" = "participants_and_admin",
  ): Promise<RatingData> {
    type RatingEnvelope = { ok: true; data: RatingData; statusCode: number };
    const body: { rating: number; comment?: string; commentVisibility: "participants_and_admin" | "admin_only" } = {
      rating,
      commentVisibility,
    };
    if (comment) body.comment = comment;
    const result = await apiClient.post<RatingEnvelope>(`/rides/${rideId}/rate`, body, { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Failed to submit rating.");
    return (result.data as RatingEnvelope).data;
  },

  async closeCashPayment(
    accessToken: string,
    rideId: string,
    input: { paidClp: number; decision: "exact" | "overpaid"; note?: string },
  ): Promise<CashPaymentClosureData> {
    type ClosureEnvelope = { ok: true; data: CashPaymentClosureData; statusCode: number };
    const result = await apiClient.post<ClosureEnvelope>(
      `/cash-payments/rides/${rideId}/close`,
      input,
      { token: accessToken },
    );
    if (result.ok === false) throw new Error(result.message ?? "No se pudo registrar el pago en efectivo.");
    return (result.data as ClosureEnvelope).data;
  },
};