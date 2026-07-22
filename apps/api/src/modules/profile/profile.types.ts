/** Public profile shape returned by GET /api/profile/me */
export interface ProfileResponse {
  id:         string;
  email:      string;
  name:       string;
  role:       string;
  status:     string;
  avatarUrl:  string | null;
  phone:      string | null;
  isVerified: boolean;
  createdAt:  string; // ISO 8601
}

export type ProfileServiceResult =
  | { ok: true;  profile: ProfileResponse }
  | { ok: false; code: string; message: string; statusCode?: number };
