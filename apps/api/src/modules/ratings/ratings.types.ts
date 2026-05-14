export interface RatingResponse {
  id:            string;
  rideRequestId: string;
  raterUserId:   string;
  ratedUserId:   string;
  raterRole:     string;
  rating:        number;
  comment:       string | null;
  createdAt:     string;
  updatedAt:     string;
}

type ErrorResult = { ok: false; code: string; message: string; statusCode: number };

export type RatingResult      = { ok: true; rating: RatingResponse } | ErrorResult;
export type RatingsListResult = { ok: true; ratings: RatingResponse[] } | ErrorResult;
