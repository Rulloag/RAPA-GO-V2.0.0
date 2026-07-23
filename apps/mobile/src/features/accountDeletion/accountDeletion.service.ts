import {
  apiClient,
  type ApiResponse,
} from "../../services/api/index.js";

export type AccountDeletionRequestStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "deferred"
  | "rejected"
  | "failed"
  | "cancelled";

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

export type AccountDeletionRequestChannel = "app" | "web";

export interface AccountDeletionRequestData {
  id: string;
  userId: string | null;
  trackingCode: string;
  requestChannel: AccountDeletionRequestChannel;
  requesterRole: string;
  reason: string;
  comment: string | null;
  status: AccountDeletionRequestStatus;
  adminNote: string | null;
  requestedAt: string;
  deadlineAt: string;
  deferredUntil: string | null;
  decisionReasonCode: string | null;
  retentionSummary: string | null;
  reviewedAt: string | null;
  processingAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface AccountDeletionDocumentData {
  id: string;
  documentType: string;
  status: string;
  fileUrl: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
}

export interface AdminAccountDeletionRequestData
  extends AccountDeletionRequestData {
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

  documents: AccountDeletionDocumentData[];

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

type Envelope<T> = {
  ok: true;
  data: T;
  statusCode: number;
};

function unwrap<T>(
  result: ApiResponse<Envelope<T>>,
  fallback: string,
): T {
  if (result.ok === false) {
    throw new Error(result.message ?? fallback);
  }

  return (result.data as Envelope<T>).data;
}

export const accountDeletionService = {
  async getMine(
    accessToken: string,
  ): Promise<AccountDeletionRequestData | null> {
    const result = await apiClient.get<
      Envelope<AccountDeletionRequestData | null>
    >("/account-deletion/me", {
      token: accessToken,
    });

    return unwrap(
      result,
      "No se pudo consultar la solicitud de eliminación.",
    );
  },

  async create(
    accessToken: string,
    payload: {
      reason: string;
      comment?: string;
      requesterSnapshot?: AccountDeletionClientSnapshot;
    },
  ): Promise<AccountDeletionRequestData> {
    const result = await apiClient.post<
      Envelope<AccountDeletionRequestData>
    >(
      "/account-deletion/requests",
      payload,
      { token: accessToken },
    );

    return unwrap(
      result,
      "No se pudo enviar la solicitud de eliminación.",
    );
  },

  async listForAdmin(
    accessToken: string,
    status?: AccountDeletionRequestStatus,
  ): Promise<AdminAccountDeletionRequestData[]> {
    const query = status
      ? `?status=${encodeURIComponent(status)}`
      : "";

    const result = await apiClient.get<
      Envelope<AdminAccountDeletionRequestData[]>
    >(
      `/admin/account-deletion/requests${query}`,
      { token: accessToken },
    );

    return unwrap(
      result,
      "No se pudieron cargar las solicitudes.",
    );
  },

  async approve(
    accessToken: string,
    requestId: string,
    note: string,
  ): Promise<AccountDeletionRequestData> {
    const result = await apiClient.post<
      Envelope<AccountDeletionRequestData>
    >(
      `/admin/account-deletion/requests/${requestId}/approve`,
      { note },
      { token: accessToken },
    );

    return unwrap(
      result,
      "No se pudo aprobar la eliminación.",
    );
  },

  async defer(
    accessToken: string,
    requestId: string,
    payload: {
      reasonCode:
        | "active_ride"
        | "pending_payment"
        | "wallet_balance"
        | "open_claim"
        | "chargeback_or_fraud"
        | "identity_unverified"
        | "legal_retention";
      note: string;
      deferUntil?: string;
    },
  ): Promise<AccountDeletionRequestData> {
    const result = await apiClient.post<
      Envelope<AccountDeletionRequestData>
    >(
      `/admin/account-deletion/requests/${requestId}/defer`,
      payload,
      { token: accessToken },
    );

    return unwrap(
      result,
      "No se pudo aplazar la solicitud.",
    );
  },
};
