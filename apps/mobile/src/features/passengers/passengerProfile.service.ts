import { apiClient } from "../../services/api/index.js";

export interface PassengerProfileData {
  id:                    string;
  userId:                string;
  phone:                 string | null;
  preferredLanguage:     string;
  notificationEnabled:   boolean;
  emailNotifications:    boolean;
  smsNotifications:      boolean;
  emergencyContactName:  string | null;
  emergencyContactPhone: string | null;
  createdAt:             string;
  updatedAt:             string;
}

export interface UpsertPassengerProfilePayload {
  phone?:                 string;
  preferredLanguage?:     string;
  notificationEnabled?:   boolean;
  emailNotifications?:    boolean;
  smsNotifications?:      boolean;
  emergencyContactName?:  string;
  emergencyContactPhone?: string;
}

export interface PassengerPreferences {
  preferredLanguage:   string;
  notificationEnabled: boolean;
  emailNotifications:  boolean;
  smsNotifications:    boolean;
}

type Envelope<T> = { ok: true; data: T; statusCode: number };

export const passengerProfileService = {
  async getMyProfile(accessToken: string): Promise<PassengerProfileData> {
    const result = await apiClient.get<Envelope<PassengerProfileData>>("/passengers/me/profile", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading passenger profile.");
    return (result.data as Envelope<PassengerProfileData>).data;
  },

  async upsertMyProfile(accessToken: string, data: UpsertPassengerProfilePayload): Promise<PassengerProfileData> {
    const result = await apiClient.patch<Envelope<PassengerProfileData>>("/passengers/me/profile", data, { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error saving passenger profile.");
    return (result.data as Envelope<PassengerProfileData>).data;
  },

  async getMyPreferences(accessToken: string): Promise<PassengerPreferences> {
    const result = await apiClient.get<Envelope<PassengerPreferences>>("/passengers/me/preferences", { token: accessToken });
    if (!result.ok) throw new Error((result as { message?: string }).message ?? "Error loading passenger preferences.");
    return (result.data as Envelope<PassengerPreferences>).data;
  },
};
