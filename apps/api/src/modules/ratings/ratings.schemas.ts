import { z } from "zod";

export const ratingCommentVisibilitySchema = z.enum([
  "participants_and_admin",
  "admin_only",
]);

export const rateRideSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  commentVisibility: ratingCommentVisibilitySchema.default("participants_and_admin"),
});

export const moderateRatingSchema = z.object({
  moderationStatus: z.enum(["visible", "hidden"]),
  moderationReason: z.string().trim().max(500).optional(),
});

export type RateRideInput = z.infer<typeof rateRideSchema>;
export type ModerateRatingInput = z.infer<typeof moderateRatingSchema>;
