import { apiClient } from "../../services/api/index.js";

export interface FareSettingData {
  id: string; type: string; name: string; value: number; currency: string;
  description: string | null; isActive: boolean; effectiveFrom: string;
  effectiveUntil: string | null; createdAt: string; updatedAt: string;
}

export interface ZoneFareData {
  id: string; zoneFrom: string; zoneTo: string; fare: number;
  isActive: boolean; createdAt: string; updatedAt: string;
}

export const fareSettingsService = {
  async getActive(): Promise<FareSettingData[]> {
    const result = await apiClient.get<{ data: { items: FareSettingData[] } }>("/fare-settings");
    if (!result.ok) return [];
    return result.data.data.items ?? [];
  },

  async getZoneFares(params?: { zoneFrom?: string; zoneTo?: string }): Promise<ZoneFareData[]> {
    const qs = new URLSearchParams();
    if (params?.zoneFrom) qs.set("zoneFrom", params.zoneFrom);
    if (params?.zoneTo)   qs.set("zoneTo",   params.zoneTo);
    const result = await apiClient.get<{ data: { items: ZoneFareData[] } }>(`/zone-fares?${qs.toString()}`);
    if (!result.ok) return [];
    return result.data.data.items ?? [];
  },

  async listAll(token: string): Promise<FareSettingData[]> {
    const result = await apiClient.get<{ data: { items: FareSettingData[] } }>("/admin/fare-settings", { token });
    if (!result.ok) throw new Error("Error al cargar tarifas");
    return result.data.data.items ?? [];
  },

  async createFareSetting(token: string, input: Record<string, unknown>): Promise<FareSettingData> {
    const result = await apiClient.post<{ data: { setting: FareSettingData } }>("/admin/fare-settings", input, { token });
    if (!result.ok) throw new Error("Error al crear tarifa");
    return result.data.data.setting;
  },

  async updateFareSetting(token: string, id: string, input: Record<string, unknown>): Promise<FareSettingData> {
    const result = await apiClient.patch<{ data: { setting: FareSettingData } }>(`/admin/fare-settings/${id}`, input, { token });
    if (!result.ok) throw new Error("Error al actualizar tarifa");
    return result.data.data.setting;
  },

  async createZoneFare(token: string, input: { zoneFrom: string; zoneTo: string; fare: number }): Promise<ZoneFareData> {
    const result = await apiClient.post<{ data: { zoneFare: ZoneFareData } }>("/admin/zone-fares", input, { token });
    if (!result.ok) throw new Error("Error al crear tarifa de zona");
    return result.data.data.zoneFare;
  },

  async updateZoneFare(token: string, id: string, input: { fare?: number; isActive?: boolean }): Promise<ZoneFareData> {
    const result = await apiClient.patch<{ data: { zoneFare: ZoneFareData } }>(`/admin/zone-fares/${id}`, input, { token });
    if (!result.ok) throw new Error("Error al actualizar tarifa de zona");
    return result.data.data.zoneFare;
  },
};
