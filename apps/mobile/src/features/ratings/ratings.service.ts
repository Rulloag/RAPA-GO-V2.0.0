import { apiClient } from "../../services/api/index.js";

export interface DriverReceivedRatingData {
  id: string;
  rideRequestId: string;
  raterUserId: string;
  ratedUserId: string;
  raterRole: string;
  rating: number;
  comment: string | null;
  raterName: string | null;
  originText: string | null;
  destinationText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverRatingSummaryData {
  average: number;
  count: number;
  latest: DriverReceivedRatingData[];
}

export class RatingsApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "RatingsApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const ratingsService = {
  async rateRide(accessToken: string, rideId: string, rating: number, comment?: string): Promise<void> {
    const result = await apiClient.post<{ ok: true; data: unknown; statusCode: number }>(
      `/rides/${rideId}/rate`,
      { rating, ...(comment ? { comment } : {}) },
      { token: accessToken },
    );
    if (result.ok === false) {
      throw new RatingsApiError(result.code, result.message, result.statusCode);
    }
  },

  async getMySummary(accessToken: string): Promise<DriverRatingSummaryData> {
    const result = await apiClient.get<{ ok: true; data: DriverRatingSummaryData; statusCode: number }>(
      "/ratings/me/summary",
      { token: accessToken },
    );
    if (result.ok === false) {
      throw new RatingsApiError(result.code, result.message, result.statusCode);
    }
    return result.data.data;
  },
};
