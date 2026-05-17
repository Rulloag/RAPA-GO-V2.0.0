import { apiClient } from "../../services/api/index.js";

export interface DriverStatusData {
  availability:  "available" | "unavailable" | "busy";
  lastSeenAt:    string | null;
  currentRideId: string | null;
}

export const driverStatusService = {
  async getMyStatus(accessToken: string): Promise<DriverStatusData> {
    type Envelope = { ok: true; data: DriverStatusData; statusCode: number };
    const result = await apiClient.get<Envelope>("/drivers/me/status", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading status.");
    return (result.data as Envelope).data;
  },

  async updateMyStatus(accessToken: string, availability: "available" | "unavailable"): Promise<DriverStatusData> {
    type Envelope = { ok: true; data: DriverStatusData; statusCode: number };
    const result = await apiClient.patch<Envelope>("/drivers/me/status", { availability }, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error updating status.");
    return (result.data as Envelope).data;
  },
};
