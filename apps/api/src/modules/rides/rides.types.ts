export interface RideStopResponse {
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

export interface RidePolicyChargeResponse {
  id: string;
  sourceRideId: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  type: "late_cancellation" | "no_show";
  status: string;
  paymentMethod: string | null;
  applicableFareClp: number;
  feePercent: number;
  feeCapClp: number;
  calculatedAmountClp: number;
  approvedAmountClp: number | null;
  amountClp: number;
  driverSharePercent: number | null;
  platformSharePercent: number | null;
  driverShareClp: number | null;
  platformShareClp: number | null;
  reason: string | null;
  adminDecisionReason: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  appliedToRideId: string | null;
  appliedAt: string | null;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RideRequestResponse {
  id:                  string;
  passengerUserId:     string;
  driverUserId:        string | null;
  driverName:          string | null;
  driverPhone:         string | null;
  originText:          string;
  destinationText:     string;
  notes:               string | null;
  estimatedFareClp:    number | null;
  originLat?:           number | null;
  originLng?:           number | null;
  destinationLat?:      number | null;
  destinationLng?:      number | null;
  distanceMeters?:      number | null;
  durationSeconds?:     number | null;
  fareCalculationSource?: string;
  status:              string;
  requestedAt:         string;
  acceptedAt:          string | null;
  enRouteAt:           string | null;
  arrivedAt:           string | null;
  startedAt:           string | null;
  completedAt:         string | null;
  cancelledAt:         string | null;
  cancellationReason:  string | null;
  cancelledByRole:     string | null;
  createdAt:           string;
  updatedAt:           string;
  driverRatingAverage:  number | null;
  driverRatingCount:    number;
  driverVehicleBrand:   string | null;
  driverVehicleModel:   string | null;
  driverVehicleYear:    number | null;
  driverVehiclePlate:   string | null;
  driverVehicleColor:   string | null;
  discountApplied:      boolean;
  discountPercent:      number | null;
  originalFareClp:      number | null;
  rideType?:             string;
  scheduledPickupAt?:    string | null;
  priorityFeeClp?:       number | null;
  flightNumber?:         string | null;
  preferredDriverGender?: "female" | null;
  stops?:                RideStopResponse[] | undefined;

  /** Forma de pago persistida por el backend para este viaje. */
  paymentMethod?: "cash" | "card" | null;
  paymentProvider?: string | null;

  /** Indica si la cuenta pidió usar su Beneficio disponible. */
  walletBenefitRequested?: boolean;

  /** Tarifa y cargos antes de descontar Beneficios. */
  fareBeforeWalletBenefitClp?: number | null;

  /** Beneficio realmente consumido por el backend. */
  walletBenefitAppliedClp?: number;

  /** Beneficio que quedó disponible después de crear el viaje. */
  walletBenefitRemainingClp?: number;

  /** Beneficio restituido automáticamente si el viaje fue cancelado o No Show. */
  walletBenefitReversedClp?: number;
  walletBenefitReversedAt?: string | null;

  /** Tarifa antes de cargos administrativos del viaje anterior. */
  baseFareClp?: number | null;

  /** Suma de cargos aprobados aplicada por el backend a este viaje. */
  policyChargesAppliedClp?: number;

  /** Detalle de cargos que fueron adjuntados al crear el viaje. */
  policyChargesApplied?: RidePolicyChargeResponse[];

  /** Cargo creado al cancelar o declarar No Show. */
  policyCharge?: RidePolicyChargeResponse | null;

  /** Resultado de devolución de pago, cuando corresponda. */
  paymentRefund?: Record<string, unknown> | null;
}

/** Subset exposed to driver for their own rides — no passenger identity. */
export interface DriverRideResponse {
  id:                    string;
  originText:            string;
  destinationText:       string;
  notes:                 string | null;
  estimatedFareClp:      number | null;
  originLat:             number | null;
  originLng:             number | null;
  destinationLat:        number | null;
  destinationLng:        number | null;
  distanceMeters:        number | null;
  durationSeconds:       number | null;
  fareCalculationSource: string;
  status:                string;
  requestedAt:           string;
  acceptedAt:            string | null;
  enRouteAt:             string | null;
  arrivedAt:             string | null;
  startedAt:             string | null;
  completedAt:           string | null;
  cancelledAt:           string | null;
  cancellationReason:    string | null;
  cancelledByRole:       string | null;
  createdAt:             string;
  rideType:              string;
  scheduledPickupAt:     string | null;
  priorityFeeClp:        number | null;
  flightNumber:          string | null;
  stops?:                RideStopResponse[] | undefined;
}

export type DriverRidesListResult =
  | { ok: true; rides: DriverRideResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

/** Subset exposed to drivers browsing available rides — no passenger identity. */
export interface AvailableRideResponse {
  id:               string;
  originText:       string;
  destinationText:  string;
  notes:            string | null;
  estimatedFareClp: number | null;
  distanceMeters?:  number | null;
  durationSeconds?: number | null;
  fareCalculationSource?: string;
  status:           string;
  requestedAt:      string;
  createdAt:        string;
}

export type AvailableRidesResult =
  | { ok: true; rides: AvailableRideResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export interface RideRouteHistoryPointResponse {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  capturedAt: string;
}

export type RideRouteHistoryResult =
  | {
      ok: true;
      rideId: string;
      points: RideRouteHistoryPointResponse[];
    }
  | { ok: false; code: string; message: string; statusCode: number };

export type RidesListResult =
  | { ok: true; rides: RideRequestResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type RideResult =
  | { ok: true; ride: RideRequestResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type PolicyChargesResult =
  | { ok: true; charges: RidePolicyChargeResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type AdminPolicyChargesResult = PolicyChargesResult;
