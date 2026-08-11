import { apiClient } from "../../services/api/index.js";

export type DriverCashPaymentDecision = "exact" | "overpaid";

export interface CashPaymentClosureData {
  id: string;
  rideRequestId: string;
  passengerUserId: string;
  driverUserId: string;
  fareClp: number;
  paidClp: number;
  overpaidClp: number;
  decision: DriverCashPaymentDecision;
  status: string;
  resolutionType: string | null;
  resolutionReferenceId: string | null;
  driverNote: string | null;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

type Envelope<T> = { ok: true; data: T; statusCode: number };

export const cashPaymentsService = {
  async close(
    accessToken: string,
    rideId: string,
    payload: { paidClp: number; decision: DriverCashPaymentDecision; note?: string },
  ): Promise<CashPaymentClosureData> {
    const result = await apiClient.post<Envelope<CashPaymentClosureData>>(
      `/cash-payments/rides/${encodeURIComponent(rideId)}/close`,
      payload,
      { token: accessToken, timeoutMs: 15000 },
      1,
    );

    if (!result.ok) {
      throw new Error((result as { message?: string }).message ?? "No se pudo confirmar el efectivo recibido en el backend.");
    }

    const envelope = result.data as Envelope<CashPaymentClosureData> | undefined;
    if (!envelope || envelope.ok !== true || !envelope.data) {
      throw new Error("El backend no confirmó el cierre del pago en efectivo.");
    }

    return envelope.data;
  },
};
