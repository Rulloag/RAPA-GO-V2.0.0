export type RatingCommentVisibility = "participants_and_admin" | "admin_only";
export type RatingModerationStatus = "visible" | "hidden";

export interface RatingResponse {
  id: string;
  rideRequestId: string;
  raterUserId: string;
  ratedUserId: string;
  raterRole: string;
  rating: number;
  comment: string | null;
  commentVisibility: RatingCommentVisibility;
  moderationStatus: RatingModerationStatus;
  moderationReason: string | null;
  moderatedByUserId: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivedRatingResponse extends RatingResponse {
  raterName: string | null;
  originText: string | null;
  destinationText: string | null;
}

export interface RatingSummaryResponse {
  average: number;
  count: number;
  latest: ReceivedRatingResponse[];
}

type ErrorResult = {
  ok: false;
  code: string;
  message: string;
  statusCode: number;
};

export type RatingResult = { ok: true; rating: RatingResponse } | ErrorResult;
export type RatingsListResult = { ok: true; ratings: RatingResponse[] } | ErrorResult;
export type RatingSummaryResult = { ok: true; summary: RatingSummaryResponse } | ErrorResult;
