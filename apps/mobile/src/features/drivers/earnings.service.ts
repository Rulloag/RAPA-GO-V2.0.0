import { apiClient } from "../../services/api/index.js";

export interface TodayEarnings {
  date:                 string;
  grossFareClp:         number;
  appCommissionPercent: number;
  appCommissionClp:     number;
  netEarningsClp:       number;
  completedRides:       number;
}

type Envelope = { ok: true; data: TodayEarnings; statusCode: number };

export const earningsService = {
  async getTodayEarnings(accessToken: string): Promise<TodayEarnings> {
    const result = await apiClient.get<Envelope>("/drivers/me/earnings/today", { token: accessToken });
    if (result.ok === false) throw new Error(result.message ?? "Error al cargar ganancias.");
    return (result.data as Envelope).data;
  },
};
