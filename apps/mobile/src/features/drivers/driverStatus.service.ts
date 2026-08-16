import { apiClient } from "../../services/api/index.js";

export interface DriverStatusData {
  availability:  "available" | "unavailable" | "busy";
  currentZone:   string | null;
  lastSeenAt:    string | null;
  currentRideId: string | null;
  /** Viaje en cola (Fase 0/2) — no nulo cuando el conductor ya reservó un próximo viaje mientras termina el actual. */
  queuedRideId?: string | null;
}

export const driverStatusService = {
  async getMyStatus(accessToken: string): Promise<DriverStatusData> {
    type Envelope = { ok: true; data: DriverStatusData; statusCode: number };
    const result = await apiClient.get<Envelope>("/drivers/me/status", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading status.");
    return (result.data as Envelope).data;
  },

  async updateMyStatus(accessToken: string, availability: "available" | "unavailable", currentZone?: string | null): Promise<DriverStatusData> {
    type Envelope = { ok: true; data: DriverStatusData; statusCode: number };
    const body: { availability: string; currentZone?: string | null } = { availability };
    if (currentZone !== undefined) body.currentZone = currentZone;
    const result = await apiClient.patch<Envelope>("/drivers/me/status", body, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error updating status.");
    return (result.data as Envelope).data;
  },
};
