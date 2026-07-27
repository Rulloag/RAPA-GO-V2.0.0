export type AccountDeletionRequestStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "deferred"
  | "identity_not_verified"
  | "failed"
  | "cancelled";

export type AccountDeletionRequestChannel = "app" | "web";

export interface AccountDeletionClientSnapshot {
  phone?: string | null;
  rut?: string | null;
  passengerType?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  vehiclePlate?: string | null;
  vehicleColor?: string | null;
  licenseNumber?: string | null;
  sourceView?: "passenger" | "driver" | null;
}

export interface AccountDeletionRequestResponse {
  id: string;
  userId: string | null;
  trackingCode: string;
  requestChannel: AccountDeletionRequestChannel;
  requesterRole: string;
  reason: string | null;
  comment: string | null;
  status: AccountDeletionRequestStatus;
  adminNote: string | null;
  requestedAt: string;
  verifiedAt: string;
  deadlineAt: string;
  deferredUntil: string | null;
  decisionReasonCode: string | null;
  retentionSummary: string | null;
  reviewedAt: string | null;
  processingAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  appleRevocationStatus:
    | "not_applicable"
    | "pending"
    | "revoked"
    | "already_invalid"
    | "failed";
  appleRevocationAttemptedAt: string | null;
  appleRevokedAt: string | null;
  appleRevocationError: string | null;
}

export interface PublicAccountDeletionStatusResponse {
  trackingCode: string;
  status: AccountDeletionRequestStatus;
  requestedAt: string;
  verifiedAt: string;
  deadlineAt: string;
  deferredUntil: string | null;
  decisionReasonCode: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  adminNote: string | null;
  failureReason: string | null;
  retentionSummary: string | null;
}

export interface AccountDeletionDocumentSummary {
  id: string;
  documentType: string;
  status: string;
  fileUrl: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
}

export interface AccountDeletionAdminResponse
  extends AccountDeletionRequestResponse {
  requester: {
    name: string;
    email: string;
    role: string;
    status: string;
    isVerified: boolean;
    createdAt: string;
    avatarUrl: string | null;
  } | null;

  clientSnapshot: AccountDeletionClientSnapshot | null;

  passengerProfile: {
    phone: string | null;
    preferredLanguage: string;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  } | null;

  driverProfile: {
    phone: string | null;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    vehiclePlate: string | null;
    vehicleColor: string | null;
    licenseNumber: string | null;
    licenseExpiry: string | null;
  } | null;

  application: {
    type: string;
    status: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    rut: string | null;
    birthDate: string | null;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    vehiclePlate: string | null;
    vehicleColor: string | null;
    licenseNumber: string | null;
    licenseExpiry: string | null;
  } | null;

  documents: AccountDeletionDocumentSummary[];

  accountSummary: {
    totalRides: number;
    activeRides: number;
    pendingPayments: number;
    walletBalanceClp: number;
    activeServiceBookings: number;
    activeRentalBookings: number;
    activeEventTickets: number;
    openSupportCases: number;
  };

  blockers: string[];
  canApprove: boolean;
}
