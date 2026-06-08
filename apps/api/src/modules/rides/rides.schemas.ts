import { z } from "zod";

// Rapa Nui is ~25 km long. 100 km is a generous upper bound for any route on the island.
const MAX_DISTANCE_METERS = 100_000;

// ~55 m — prevents trivially same origin/destination
const MIN_COORD_DIFF = 0.0005;

// Scheduled ride constraints
const MIN_SCHEDULED_MINUTES = 30;
const MAX_SCHEDULED_DAYS    = 30;

const destinationItemSchema = z.object({
  text:  z.string().trim().min(1, "Destination text is required.").max(150),
  lat:   z.number().min(-90, "lat must be ≥ -90.").max(90, "lat must be ≤ 90."),
  lng:   z.number().min(-180, "lng must be ≥ -180.").max(180, "lng must be ≤ 180."),
  order: z.number().int().min(1, "order must be ≥ 1.").max(3, "order must be ≤ 3."),
});

const segmentItemSchema = z.object({
  fromOrder:       z.number().int().min(0),
  toOrder:         z.number().int().min(1),
  distanceMeters:  z.number().int().min(1, "Segment distanceMeters must be > 0."),
  durationSeconds: z.number().int().min(1, "Segment durationSeconds must be > 0."),
});

export const createRideRequestSchema = z
  .object({
    originText:      z.string().trim().min(3,  "Origin must be at least 3 characters.").max(150),
    destinationText: z.string().trim().min(3,  "Destination must be at least 3 characters.").max(150).optional(),
    originLat:       z.number().min(-90,   "originLat must be ≥ -90.")   .max(90,   "originLat must be ≤ 90."),
    originLng:       z.number().min(-180,  "originLng must be ≥ -180.")  .max(180,  "originLng must be ≤ 180."),
    destinationLat:  z.number().min(-90,   "destinationLat must be ≥ -90.").max(90,   "destinationLat must be ≤ 90.").optional(),
    destinationLng:  z.number().min(-180,  "destinationLng must be ≥ -180.").max(180,  "destinationLng must be ≤ 180.").optional(),
    distanceMeters:  z
      .number()
      .int("distanceMeters must be an integer.")
      .min(1,                  "distanceMeters must be greater than 0.")
      .max(MAX_DISTANCE_METERS, `distanceMeters exceeds the maximum allowed for Rapa Nui (${MAX_DISTANCE_METERS} m).`)
      .optional(),
    durationSeconds: z
      .number()
      .int("durationSeconds must be an integer.")
      .min(1, "durationSeconds must be greater than 0.")
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters.")
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    rideType: z
      .enum(["immediate", "scheduled"])
      .optional()
      .default("immediate"),
    scheduledPickupAt: z
      .string()
      .datetime({ message: "scheduledPickupAt must be a valid ISO 8601 datetime." })
      .optional(),
    flightNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(20, "flightNumber must not exceed 20 characters.")
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    destinations: z
      .array(destinationItemSchema)
      .min(1, "destinations must have at least 1 item.")
      .max(3, "destinations must have at most 3 items.")
      .optional(),
    segments: z.array(segmentItemSchema).optional(),
  })
  // ── Legacy path: require destinationText/Lat/Lng when no destinations array ──
  .refine(
    (data) => data.destinations !== undefined || data.destinationText !== undefined,
    { message: "destinationText is required.", path: ["destinationText"] },
  )
  .refine(
    (data) => data.destinations !== undefined || data.destinationLat !== undefined,
    { message: "destinationLat is required.", path: ["destinationLat"] },
  )
  .refine(
    (data) => data.destinations !== undefined || data.destinationLng !== undefined,
    { message: "destinationLng is required.", path: ["destinationLng"] },
  )
  // ── Legacy path: require distanceMeters/durationSeconds when no destinations ─
  .refine(
    (data) => data.destinations !== undefined || data.distanceMeters !== undefined,
    { message: "distanceMeters is required.", path: ["distanceMeters"] },
  )
  .refine(
    (data) => data.destinations !== undefined || data.durationSeconds !== undefined,
    { message: "durationSeconds is required.", path: ["durationSeconds"] },
  )
  // ── Multi-destination: require segments ───────────────────────────────────────
  .refine(
    (data) => {
      if (data.destinations !== undefined) {
        return data.segments !== undefined && data.segments.length > 0;
      }
      return true;
    },
    { message: "segments is required when destinations is provided.", path: ["segments"] },
  )
  // ── Multi-destination: segments count must equal destinations count ───────────
  .refine(
    (data) => {
      if (data.destinations !== undefined && data.segments !== undefined) {
        return data.segments.length === data.destinations.length;
      }
      return true;
    },
    { message: "segments count must equal destinations count.", path: ["segments"] },
  )
  // ── Multi-destination: orders must be sequential 1..N without gaps ────────────
  .refine(
    (data) => {
      if (data.destinations === undefined) return true;
      const orders = data.destinations.map((d) => d.order).sort((a, b) => a - b);
      return orders.every((o, i) => o === i + 1);
    },
    { message: "destination orders must be sequential starting from 1 (e.g. 1, 2, 3).", path: ["destinations"] },
  )
  // ── Multi-destination: no duplicate coordinates ───────────────────────────────
  .refine(
    (data) => {
      if (data.destinations === undefined) return true;
      const coords = data.destinations.map((d) => `${d.lat},${d.lng}`);
      return new Set(coords).size === coords.length;
    },
    { message: "destinations must not have duplicate coordinates.", path: ["destinations"] },
  )
  // ── Multi-destination: segments must follow 0→1, 1→2, 2→3 sequence ───────────
  .refine(
    (data) => {
      if (data.destinations === undefined || data.segments === undefined) return true;
      const sorted = [...data.segments].sort((a, b) => a.fromOrder - b.fromOrder);
      return sorted.every((seg, i) => seg.fromOrder === i && seg.toOrder === i + 1);
    },
    { message: "segments must follow fromOrder/toOrder sequence: 0→1, 1→2, 2→3.", path: ["segments"] },
  )
  // ── Legacy: origin and (single) destination must differ ──────────────────────
  .refine(
    (data) => {
      if (data.destinations !== undefined) return true;
      if (data.destinationLat === undefined || data.destinationLng === undefined) return true;
      const latDiff = Math.abs(data.originLat - data.destinationLat);
      const lngDiff = Math.abs(data.originLng - data.destinationLng);
      return latDiff > MIN_COORD_DIFF || lngDiff > MIN_COORD_DIFF;
    },
    {
      message: "Origin and destination are too close — please choose different locations.",
      path:    ["destinationLat"],
    },
  )
  .refine(
    (data) => {
      if (data.rideType === "scheduled") {
        return data.scheduledPickupAt !== undefined;
      }
      return true;
    },
    {
      message: "scheduledPickupAt is required for scheduled rides.",
      path:    ["scheduledPickupAt"],
    },
  )
  .refine(
    (data) => {
      if (data.rideType === "scheduled" && data.scheduledPickupAt) {
        const pickup = new Date(data.scheduledPickupAt);
        const minPickup = new Date(Date.now() + MIN_SCHEDULED_MINUTES * 60 * 1000);
        return pickup >= minPickup;
      }
      return true;
    },
    {
      message: `scheduledPickupAt must be at least ${MIN_SCHEDULED_MINUTES} minutes in the future.`,
      path:    ["scheduledPickupAt"],
    },
  )
  .refine(
    (data) => {
      if (data.rideType === "scheduled" && data.scheduledPickupAt) {
        const pickup = new Date(data.scheduledPickupAt);
        const maxPickup = new Date(Date.now() + MAX_SCHEDULED_DAYS * 24 * 60 * 60 * 1000);
        return pickup <= maxPickup;
      }
      return true;
    },
    {
      message: `scheduledPickupAt must be within ${MAX_SCHEDULED_DAYS} days from now.`,
      path:    ["scheduledPickupAt"],
    },
  )
  .refine(
    (data) => {
      if (data.rideType === "immediate" && data.scheduledPickupAt) {
        return false;
      }
      return true;
    },
    {
      message: "scheduledPickupAt must not be provided for immediate rides.",
      path:    ["scheduledPickupAt"],
    },
  );

export type CreateRideRequestInput = z.infer<typeof createRideRequestSchema>;

export const cancelAcceptedSchema = z.object({
  reason: z.string().trim().max(500, "Reason must not exceed 500 characters.").optional()
            .transform((v) => (v === "" ? undefined : v)),
});

export type CancelAcceptedInput = z.infer<typeof cancelAcceptedSchema>;
