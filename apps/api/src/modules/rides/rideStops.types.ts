/** A single stop in a multi-destination ride (as stored in the DB). */
export interface RideStop {
  id:                     string;
  rideRequestId:          string;
  stopOrder:              number;
  label:                  string;
  lat:                    number;
  lng:                    number;
  segmentDistanceMeters:  number | null;
  segmentDurationSeconds: number | null;
  segmentFareClp:         number | null;
  arrivedAt:              string | null;
  completedAt:            string | null;
  createdAt:              string;
  updatedAt:              string;
}

/** Input shape used when creating stops for a ride. */
export interface RideStopInput {
  stopOrder:              number;
  label:                  string;
  lat:                    number;
  lng:                    number;
  segmentDistanceMeters?: number | null;
  segmentDurationSeconds?: number | null;
  segmentFareClp?:        number | null;
}

/** Shape returned to callers (timestamps serialised to ISO strings). */
export interface RideStopResponse {
  id:                     string;
  rideRequestId:          string;
  stopOrder:              number;
  label:                  string;
  lat:                    number;
  lng:                    number;
  segmentDistanceMeters:  number | null;
  segmentDurationSeconds: number | null;
  segmentFareClp:         number | null;
  arrivedAt:              string | null;
  completedAt:            string | null;
}
