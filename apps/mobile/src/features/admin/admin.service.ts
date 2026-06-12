import { apiClient } from "../../services/api/index.js";

export interface AdminUserData {
  id:         string;
  email:      string;
  name:       string;
  role:       string;
  status:     string;
  isVerified: boolean;
  createdAt:  string;
}

export interface AdminDocumentData {
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

export interface ListUsersParams {
  role?:   string;
  status?: string;
  search?: string;
}

export interface ListDocumentsParams {
  status?:       string;
  documentType?: string;
  userId?:       string;
}

export interface AdminRideData {
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
  rideType?:              "immediate" | "scheduled";
  scheduledPickupAt?:     string | null;
  priorityFeeClp?:        number | null;
  flightNumber?:          string | null;
  preferredDriverGender?: "female" | null;
}

export interface ActiveDriverData {
  id:            string;
  name:          string;
  email:         string;
  status:        string;
  isVerified:    boolean;
  createdAt:     string;
  availability:  string;
  currentRideId: string | null;
  lastSeenAt:    string | null;
  currentZone:   string | null;
}

export interface ListRidesParams {
  status?:          string;
  driverUserId?:    string;
  passengerUserId?: string;
}

export const adminService = {
  async updateUserStatus(accessToken: string, userId: string, status: string): Promise<AdminUserData> {
    type Envelope = { ok: true; data: AdminUserData; statusCode: number };
    const result = await apiClient.patch<Envelope>(
      `/admin/users/${userId}/status`,
      { status },
      { token: accessToken },
    );
    if (!result.ok) throw new Error(result.message ?? "Failed to update user status.");
    return (result.data as Envelope).data;
  },

  async listUsers(accessToken: string, params: ListUsersParams = {}): Promise<AdminUserData[]> {
    type Envelope = { ok: true; data: AdminUserData[]; statusCode: number };
    const parts: string[] = [];
    if (params.role)   parts.push(`role=${encodeURIComponent(params.role)}`);
    if (params.status) parts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.search) parts.push(`search=${encodeURIComponent(params.search)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    const result = await apiClient.get<Envelope>(`/admin/users${qs}`, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load users.");
    return (result.data as Envelope).data;
  },

  async listDocuments(accessToken: string, params: ListDocumentsParams = {}): Promise<AdminDocumentData[]> {
    type Envelope = { ok: true; data: AdminDocumentData[]; statusCode: number };
    const parts: string[] = [];
    if (params.status)       parts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.documentType) parts.push(`documentType=${encodeURIComponent(params.documentType)}`);
    if (params.userId)       parts.push(`userId=${encodeURIComponent(params.userId)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    const result = await apiClient.get<Envelope>(`/admin/documents${qs}`, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load documents.");
    return (result.data as Envelope).data;
  },

  async reviewDocument(
    accessToken: string,
    documentId: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ): Promise<AdminDocumentData> {
    type Envelope = { ok: true; data: AdminDocumentData; statusCode: number };
    const body: { status: string; rejectionReason?: string } = { status };
    if (rejectionReason) body.rejectionReason = rejectionReason;
    const result = await apiClient.patch<Envelope>(
      `/admin/documents/${documentId}/review`,
      body,
      { token: accessToken },
    );
    if (!result.ok) throw new Error(result.message ?? "Failed to review document.");
    return (result.data as Envelope).data;
  },

  async listRides(accessToken: string, params: ListRidesParams = {}): Promise<AdminRideData[]> {
    type Envelope = { ok: true; data: AdminRideData[]; statusCode: number };
    const parts: string[] = [];
    if (params.status)          parts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.driverUserId)    parts.push(`driverUserId=${encodeURIComponent(params.driverUserId)}`);
    if (params.passengerUserId) parts.push(`passengerUserId=${encodeURIComponent(params.passengerUserId)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    const result = await apiClient.get<Envelope>(`/admin/rides${qs}`, { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load rides.");
    return (result.data as Envelope).data;
  },

  async listActiveDrivers(accessToken: string): Promise<ActiveDriverData[]> {
    type Envelope = { ok: true; data: ActiveDriverData[]; statusCode: number };
    const result = await apiClient.get<Envelope>("/admin/drivers/active", { token: accessToken });
    if (!result.ok) throw new Error(result.message ?? "Failed to load active drivers.");
    return (result.data as Envelope).data;
  },

  async assignDriver(accessToken: string, rideId: string, driverUserId: string): Promise<AdminRideData> {
    type Envelope = { ok: true; data: AdminRideData; statusCode: number };
    const result = await apiClient.post<Envelope>(
      `/admin/rides/${rideId}/assign`,
      { driverUserId },
      { token: accessToken },
    );
    if (!result.ok) throw new Error(result.message ?? "Failed to assign driver.");
    return (result.data as Envelope).data;
  },

  async adminCancelRide(accessToken: string, rideId: string, reason: string): Promise<AdminRideData> {
    type Envelope = { ok: true; data: AdminRideData; statusCode: number };
    const result = await apiClient.post<Envelope>(
      `/admin/rides/${rideId}/cancel`,
      { reason },
      { token: accessToken },
    );
    if (!result.ok) throw new Error(result.message ?? "Failed to cancel ride.");
    return (result.data as Envelope).data;
  },

  async syncOfflineBookingToRide(
    accessToken: string,
    offlineBookingId: string,
    driverUserId?: string,
    notes?: string,
  ): Promise<AdminRideData> {
    type Envelope = { ok: true; data: AdminRideData; statusCode: number };
    const body: Record<string, string> = {};
    if (driverUserId) body["driverUserId"] = driverUserId;
    if (notes)        body["notes"]        = notes;
    const result = await apiClient.post<Envelope>(
      `/admin/offline-bookings/${offlineBookingId}/sync-to-ride`,
      body,
      { token: accessToken },
    );
    if (!result.ok) throw new Error((result as any).message ?? "Failed to sync booking.");
    return (result.data as Envelope).data;
  },
};
