import { z } from "zod";

const vehicleCategorySchema = z
  .enum(["standard", "xl", "extra_luggage", "luggage"])
  .transform((v) => (v === "luggage" ? "extra_luggage" : v));

export const createRideRequestSchema = z.object({
  originText: z
    .string()
    .trim()
    .min(3, "Origin must be at least 3 characters.")
    .max(150),

  destinationText: z
    .string()
    .trim()
    .min(3, "Destination must be at least 3 characters.")
    .max(150),

  notes: z
    .string()
    .trim()
    .max(5000, "Notes must not exceed 5000 characters.")
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return undefined;
      const clean = v.trim();
      return clean === "" ? undefined : clean;
    }),

  estimatedFareClp: z.number().int().positive().nullable().optional(),

  paymentMethod: z.enum(["cash", "card"]).optional(),

  // Beneficios solo puede consumirse en un viaje pagado en efectivo. El monto
  // se calcula y descuenta dentro de una transacción SQL del backend.
  useWalletBenefit: z.boolean().optional(),

  paymentProvider: z
    .enum(["klap", "mercadopago", "prontopaga", "transbank"])
    .nullable()
    .optional(),

  rideMode: z.enum(["now", "scheduled"]).optional(),
  isScheduled: z.boolean().optional(),
  tripFareMode: z.enum(["one_way", "round_trip"]).optional(),

  scheduledAt: z.string().trim().nullable().optional(),
  scheduledPickupAt: z.string().trim().nullable().optional(),
  scheduledReturnAt: z.string().trim().nullable().optional(),
  scheduledActivationAt: z.string().trim().nullable().optional(),
  scheduledReturnActivationAt: z.string().trim().nullable().optional(),

  // Reserva Mataveri: el backend recibe únicamente la opción y la cantidad.
  // El valor unitario del collar se define en servidor; nunca se confía en un
  // recargo calculado por el cliente.
  airportWelcomeOption: z.enum(["none", "flower_lei"]).optional(),
  flowerLeiQuantity: z.number().int().min(1).max(20).nullable().optional(),

  // Categoría solicitada por el pasajero. Informa; no restringe matching.
  requestedVehicleCategory: vehicleCategorySchema.optional(),
  vehicleCategory: vehicleCategorySchema.optional(),
  fareVehicleCategory: vehicleCategorySchema.optional(),
});

export type CreateRideRequestInput = z.infer<
  typeof createRideRequestSchema
>;

export const cancelAcceptedSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Reason must not exceed 500 characters.")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),

  cancellationEvent: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),

  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracyMeters: z.number().nonnegative().max(100000).optional(),
      capturedAt: z.string().datetime({ offset: true }).optional(),
    })
    .optional(),
});

export type CancelAcceptedInput = z.infer<
  typeof cancelAcceptedSchema
>;

export const adminPolicyChargeReviewSchema = z.object({
  approvedAmountClp: z
    .number()
    .int()
    .positive()
    .max(5000)
    .optional(),

  adminDecisionReason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) =>
      value === "" ? undefined : value,
    ),
});

export type AdminPolicyChargeReviewInput = z.infer<
  typeof adminPolicyChargeReviewSchema
>;

export const adminUpsertApprovePolicyChargeSchema = z.object({
  rideId: z.string().uuid(),
  type: z.enum(["late_cancellation", "no_show"]),
  amountClp: z.number().int().positive().max(5000),
  applicableFareClp: z.number().int().positive().optional(),
  paymentMethod: z.string().trim().max(30).optional(),
  reason: z.string().trim().max(500).optional(),
  adminDecisionReason: z
    .string()
    .trim()
    .max(500)
    .optional(),
});

export type AdminUpsertApprovePolicyChargeInput = z.infer<
  typeof adminUpsertApprovePolicyChargeSchema
>;