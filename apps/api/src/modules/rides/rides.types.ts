export interface RideRequestResponse {
  id:                    string;
  passengerUserId:       string;
  driverUserId:          string | null;
  driverName:            string | null;
  driverPhone:           string | null;
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
  updatedAt:             string;
  driverRatingAverage:   number | null;
  driverRatingCount:     number;
  driverVehicleBrand:    string | null;
  driverVehicleModel:    string | null;
  driverVehicleYear:     number | null;
  driverVehiclePlate:    string | null;
  driverVehicleColor:    string | null;
  discountApplied:       boolean;
  discountPercent:       number | null;
  originalFareClp:       number | null;
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
}

export type DriverRidesListResult =
  | { ok: true;  rides: DriverRideResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

/** Subset exposed to drivers browsing available rides — no passenger identity. */
export interface AvailableRideResponse {
  id:                    string;
  originText:            string;
  destinationText:       string;
  notes:                 string | null;
  estimatedFareClp:      number | null;
  distanceMeters:        number | null;
  durationSeconds:       number | null;
  fareCalculationSource: string;
  status:                string;
  requestedAt:           string;
  createdAt:             string;
}

export type AvailableRidesResult =
  | { ok: true;  rides: AvailableRideResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type RidesListResult =
  | { ok: true;  rides: RideRequestResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type RideResult =
  | { ok: true;  ride: RideRequestResponse }
  | { ok: false; code: string; message: string; statusCode: number };
