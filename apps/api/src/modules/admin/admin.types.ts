export interface AdminUserResponse {
  id:         string;
  email:      string;
  name:       string;
  role:       string;
  status:     string;
  isVerified: boolean;
  createdAt:  string;
}

export interface AdminDocumentResponse {
  id:              string;
  userId:          string;
  userName:        string;
  userEmail:       string;
  userRole:        string;
  documentType:    string;
  status:          string;
  fileUrl:         string | null;
  rejectionReason: string | null;
  uploadedAt:      string | null;
  reviewedAt:      string | null;
  createdAt:       string;
}

export interface AdminRideResponse {
  id:                 string;
  passengerUserId:    string;
  passengerName:      string;
  passengerEmail:     string;
  driverUserId:       string | null;
  driverName:         string | null;
  driverEmail:        string | null;
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

export interface ActiveDriverResponse {
  id:            string;
  name:          string;
  email:         string;
  status:        string;
  isVerified:    boolean;
  createdAt:     string;
  availability:  string;
  currentRideId: string | null;
  lastSeenAt:    string | null;
}

type ErrorResult = { ok: false; code: string; message: string; statusCode: number };

export type AdminUsersListResult     = { ok: true; users:     AdminUserResponse[]     } | ErrorResult;
export type AdminUserResult          = { ok: true; user:      AdminUserResponse        } | ErrorResult;
export type AdminDocumentsListResult = { ok: true; documents: AdminDocumentResponse[] } | ErrorResult;
export type AdminDocumentResult      = { ok: true; document:  AdminDocumentResponse   } | ErrorResult;
export type AdminRidesListResult     = { ok: true; rides:     AdminRideResponse[]     } | ErrorResult;
export type AdminRideResult          = { ok: true; ride:      AdminRideResponse        } | ErrorResult;
export type ActiveDriversListResult  = { ok: true; drivers:   ActiveDriverResponse[]  } | ErrorResult;
