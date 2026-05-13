export interface RideRequestResponse {
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

/** Subset exposed to drivers — no passenger identity fields. */
export interface AvailableRideResponse {
  id:              string;
  originText:      string;
  destinationText: string;
  notes:           string | null;
  status:          string;
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
