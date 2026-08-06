import { apiClient } from "../../services/api/index.js";

export interface ProfileData {
  id:         string;
  email:      string;
  name:       string;
  role:       string;
  status:     string;
  avatarUrl:  string | null;
  phone:      string | null;
  rut:        string | null;
  birthDate:  string | null;
  isVerified: boolean;
  createdAt:  string;
}

export interface UpdateProfilePayload {
  avatarUrl?: string | null;
}

type ProfileEnvelope = { ok: true; data: ProfileData; statusCode: number };

export const profileService = {
  async getProfile(accessToken: string): Promise<ProfileData> {
    const result = await apiClient.get<ProfileEnvelope>("/profile/me", { token: accessToken });
    if (result.ok === false) {
      throw new Error(result.message ?? "Failed to load profile.");
    }
    return (result.data as ProfileEnvelope).data;
  },

  async updateProfile(accessToken: string, payload: UpdateProfilePayload): Promise<ProfileData> {
    const result = await apiClient.patch<ProfileEnvelope>("/profile/me", payload, { token: accessToken });
    if (result.ok === false) {
      throw new Error(result.message ?? "Failed to update profile.");
    }
    return (result.data as ProfileEnvelope).data;
  },
};
