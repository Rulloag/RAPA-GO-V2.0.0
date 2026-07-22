import {
  apiClient,
  type ApiResponse,
} from "../../services/api/index.js";

export type PublicAccountDeletionStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "deferred"
  | "rejected"
  | "failed"
  | "cancelled";

export interface PublicAccountDeletionRequestData {
  id: string;
  trackingCode: string;
  requestChannel: "app" | "web";
  status: PublicAccountDeletionStatus;
  requestedAt: string;
}

export interface PublicAccountDeletionStatusData {
  trackingCode: string;
  status: PublicAccountDeletionStatus;
  requestedAt: string;
  deadlineAt: string;
  deferredUntil: string | null;
  decisionReasonCode: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  adminNote: string | null;
  failureReason: string | null;
  retentionSummary: string | null;
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

export const publicAccountDeletionService = {
  async requestCode(email: string): Promise<{
    message: string;
    expiresMinutes: number;
  }> {
    const result = await apiClient.post<
      Envelope<{ message: string; expiresMinutes: number }>
    >(
      "/account-deletion/public/code",
      { email },
      undefined,
      0,
    );

    return unwrap(
      result,
      "No se pudo enviar el código de verificación.",
    );
  },

  async submit(payload: {
    email: string;
    code: string;
    reason: string;
    comment?: string;
    accepted: true;
  }): Promise<PublicAccountDeletionRequestData> {
    const result = await apiClient.post<
      Envelope<PublicAccountDeletionRequestData>
    >(
      "/account-deletion/public/requests",
      payload,
      undefined,
      0,
    );

    return unwrap(
      result,
      "No se pudo enviar la solicitud de eliminación.",
    );
  },

  async status(
    email: string,
    trackingCode: string,
  ): Promise<PublicAccountDeletionStatusData> {
    const query = new URLSearchParams({
      email,
      trackingCode,
    });

    const result = await apiClient.get<
      Envelope<PublicAccountDeletionStatusData>
    >(`/account-deletion/public/status?${query.toString()}`);

    return unwrap(
      result,
      "No se pudo consultar el estado de la solicitud.",
    );
  },
};
