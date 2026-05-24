export interface FareSettingResponse {
  id: string; type: string; name: string; value: number; currency: string;
  description: string | null; isActive: boolean; effectiveFrom: string;
  effectiveUntil: string | null; createdAt: string; updatedAt: string;
}

export interface ZoneFareResponse {
  id: string; zoneFrom: string; zoneTo: string; fare: number;
  isActive: boolean; createdAt: string; updatedAt: string;
}

export type FareSettingsResult =
  | { ok: true; items: FareSettingResponse[] }
  | { ok: false; code: string; message: string; statusCode: number };

export type FareSettingResult =
  | { ok: true; setting: FareSettingResponse }
  | { ok: false; code: string; message: string; statusCode: number };

export type ZoneFaresResult =
  | { ok: true; items: ZoneFareResponse[]; total: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type ZoneFareResult =
  | { ok: true; zoneFare: ZoneFareResponse }
  | { ok: false; code: string; message: string; statusCode: number };
