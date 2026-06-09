export type RideAssignmentOfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export type OfferResponseSource = "driver" | "system_expire" | "admin_cancel";

/** Shape stored in the database (timestamps as Date objects). */
export interface RideAssignmentOffer {
  id:              string;
  rideRequestId:   string;
  driverUserId:    string;
  status:          RideAssignmentOfferStatus;
  offeredAt:       Date;
  expiresAt:       Date;
  respondedAt:     Date | null;
  responseSource:  OfferResponseSource | null;
  attemptOrder:    number;
  createdAt:       Date;
  updatedAt:       Date;
}

/** Input used when creating a new offer. */
export interface RideAssignmentOfferInput {
  rideRequestId:  string;
  driverUserId:   string;
  expiresAt:      Date;
  attemptOrder?:  number;
}

/** Shape returned to callers (timestamps as ISO strings). */
export interface RideAssignmentOfferResponse {
  id:              string;
  rideRequestId:   string;
  driverUserId:    string;
  status:          RideAssignmentOfferStatus;
  offeredAt:       string;
  expiresAt:       string;
  respondedAt:     string | null;
  responseSource:  OfferResponseSource | null;
  attemptOrder:    number;
}
