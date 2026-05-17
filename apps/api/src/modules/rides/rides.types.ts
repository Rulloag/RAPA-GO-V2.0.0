export interface RideRequestResponse {
  id:                  string;
  passengerUserId:     string;
  driverUserId:        string | null;
  driverName:          string | null;
  originText:          string;
  destinationText:     string;
  notes:               string | null;
  estimatedFareClp:    number | null;
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
  driverRatingAverage: number | null;
  driverRatingCount:   number;
}

/** Subset exposed to driver for their own rides — no passenger identity. */
export interface DriverRideResponse {
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

export type DriverRidesListResult =
  | { ok: true;  rides: DriverRideResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

/** Subset exposed to drivers — no passenger identity fields. */
export interface AvailableRideResponse {
  id:               string;
  originText:       string;
  destinationText:  string;
  notes:            string | null;
  estimatedFareClp: number | null;
  status:           string;
  requestedAt:     string;
  createdAt:       string;
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
