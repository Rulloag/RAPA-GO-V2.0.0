import { apiClient } from "../../services/api/index.js";

export interface DriverProfileData {
  id:              string;
  userId:          string;
  phone:           string | null;
  vehicleBrand:    string | null;
  vehicleModel:    string | null;
  vehicleYear:     number | null;
  vehiclePlate:    string | null;
  vehicleColor:    string | null;
  licenseNumber:   string | null;
  licenseExpiry:   string | null;
  profilePhotoUrl: string | null;
  bio:             string | null;
  languages:       string[];
  createdAt:       string;
  updatedAt:       string;
}

export interface UpsertDriverProfilePayload {
  phone?:           string;
  vehicleBrand?:    string;
  vehicleModel?:    string;
  vehicleYear?:     number;
  vehiclePlate?:    string;
  vehicleColor?:    string;
  licenseNumber?:   string;
  licenseExpiry?:   string;
  profilePhotoUrl?: string;
  bio?:             string;
  languages?:       string[];
}

type Envelope<T> = { ok: true; data: T; statusCode: number };

export const driverProfileService = {
  async getMyProfile(accessToken: string): Promise<DriverProfileData | null> {
    const result = await apiClient.get<Envelope<DriverProfileData | null>>("/drivers/me/profile", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading driver profile.");
    return (result.data as Envelope<DriverProfileData | null>).data;
  },

  async upsertMyProfile(accessToken: string, payload: UpsertDriverProfilePayload): Promise<DriverProfileData> {
    const result = await apiClient.patch<Envelope<DriverProfileData>>("/drivers/me/profile", payload, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error saving driver profile.");
    return (result.data as Envelope<DriverProfileData>).data;
  },
};
