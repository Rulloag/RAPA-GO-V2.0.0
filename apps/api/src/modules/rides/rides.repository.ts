import { and, asc, avg, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  driverProfiles,
  rideDriverAssignments,
  rideRatings,
  rideRequests,
  transactions,
  users,
  wallets,
} from "../../db/schema/index.js";
import { alias } from "drizzle-orm/pg-core";
import { AppError } from "../../shared/errors/AppError.js";
import type { RideRequest } from "../../db/schema/index.js";
import {
  ridePolicyCharges,
  type RidePolicyCharge,
  type NewRidePolicyCharge,
} from "../../db/schema/ridePolicyCharges.schema.js";
import { roundFareUpTo500 } from "./ridePolicy.js";

type RapaGoTransaction =
  Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Devuelve exactamente una vez el Beneficio consumido por un viaje que terminó
 * cancelado o No Show. La operación ocurre en la misma transacción que cierra
 * el viaje para que nunca exista una cancelación sin restitución financiera.
 */
async function restoreAppliedWalletBenefit(
  tx: RapaGoTransaction,
  ride: RideRequest,
  restoredAt: Date,
  reason: "ride_cancelled" | "passenger_no_show",
): Promise<RideRequest> {
  const appliedClp = Math.max(
    0,
    Math.round(Number(ride.walletBenefitAppliedClp ?? 0)),
  );
  const alreadyReversedClp = Math.max(
    0,
    Math.round(Number(ride.walletBenefitReversedClp ?? 0)),
  );
  const amountToRestoreClp = Math.max(
    0,
    appliedClp - alreadyReversedClp,
  );

  if (
    amountToRestoreClp <= 0 ||
    ride.paymentMethod !== "cash"
  ) {
    return ride;
  }

  await tx.execute(
    sql`select id from wallets where user_id = ${ride.passengerUserId} for update`,
  );

  const wallet = (
    await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, ride.passengerUserId))
      .limit(1)
  )[0];

  if (!wallet || wallet.status !== "active") {
    throw AppError.internal(
      "Cannot restore the applied Benefit because the account wallet is unavailable.",
    );
  }

  const walletBalanceBeforeClp = Math.max(
    0,
    Math.round(Number(wallet.balance ?? 0)),
  );
  const walletBalanceAfterClp =
    walletBalanceBeforeClp + amountToRestoreClp;

  const [updatedWallet] = await tx
    .update(wallets)
    .set({
      balance: walletBalanceAfterClp,
      updatedAt: restoredAt,
    })
    .where(eq(wallets.id, wallet.id))
    .returning();

  if (!updatedWallet) {
    throw AppError.internal(
      "Wallet update returned no rows while restoring a Benefit.",
    );
  }

  await tx.insert(transactions).values({
    walletId: wallet.id,
    userId: ride.passengerUserId,
    rideId: ride.id,
    type: "benefit_reversal",
    amount: amountToRestoreClp,
    currency: "CLP",
    status: "completed",
    provider: "rapago",
    providerTransactionId: `benefit-reversal:${ride.id}`,
    description:
      reason === "passenger_no_show"
        ? "Beneficio restituido porque el viaje terminó como No Show"
        : "Beneficio restituido porque el viaje fue cancelado",
    metadata: {
      source: "cash_overpayment_benefit",
      exclusiveToOwner: true,
      cashRideOnly: true,
      reversalReason: reason,
      appliedClp,
      previouslyReversedClp: alreadyReversedClp,
      restoredClp: amountToRestoreClp,
      balanceBeforeClp: walletBalanceBeforeClp,
      balanceAfterClp: walletBalanceAfterClp,
    },
  });

  const [restoredRide] = await tx
    .update(rideRequests)
    .set({
      walletBenefitReversedClp:
        alreadyReversedClp + amountToRestoreClp,
      walletBenefitReversedAt: restoredAt,
      updatedAt: restoredAt,
    })
    .where(
      and(
        eq(rideRequests.id, ride.id),
        eq(
          rideRequests.walletBenefitReversedClp,
          alreadyReversedClp,
        ),
      ),
    )
    .returning();

  if (!restoredRide) {
    throw AppError.internal(
      "Ride update returned no rows while restoring a Benefit.",
    );
  }

  return restoredRide;
}

export interface RideWithDriverName extends RideRequest {
  driverName:          string | null;
  driverPhone:         string | null;
  driverRatingAverage: number | null;
  driverRatingCount:   number;
  driverVehicleBrand:  string | null;
  driverVehicleModel:  string | null;
  driverVehicleYear:   number | null;
  driverVehiclePlate:  string | null;
  driverVehicleColor:  string | null;
}



export interface RidePolicyChargeWithOwner extends RidePolicyCharge {
  ownerName: string | null;
  ownerEmail: string | null;
}

export interface RideCreatedWithPolicyCharges {
  ride: RideRequest;
  appliedCharges: RidePolicyCharge[];
  appliedChargesTotalClp: number;
  fareBeforeWalletBenefitClp: number;
  walletBenefitRequested: boolean;
  walletBenefitAppliedClp: number;
  walletBenefitRemainingClp: number;
}

export class RidesRepository {
  async findByPassengerId(passengerUserId: string): Promise<RideRequest[]> {
    try {
      return await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.passengerUserId, passengerUserId))
        .orderBy(desc(rideRequests.requestedAt));
    } catch (err) {
      throw AppError.internal(`Failed to query ride requests: ${String(err)}`);
    }
  }

  async findByPassengerIdWithDriver(passengerUserId: string): Promise<RideWithDriverName[]> {
    try {
      const driver = alias(users, "driver");
      const rows = await db
        .select({
          id:                 rideRequests.id,
          passengerUserId:    rideRequests.passengerUserId,
          driverUserId:       rideRequests.driverUserId,
          originText:         rideRequests.originText,
          destinationText:    rideRequests.destinationText,
          notes:              rideRequests.notes,
          estimatedFareClp:   rideRequests.estimatedFareClp,
          paymentMethod:      rideRequests.paymentMethod,
          paymentProvider:    rideRequests.paymentProvider,
          walletBenefitRequested: rideRequests.walletBenefitRequested,
          walletBenefitAppliedClp: rideRequests.walletBenefitAppliedClp,
          walletBenefitReversedClp: rideRequests.walletBenefitReversedClp,
          walletBenefitReversedAt: rideRequests.walletBenefitReversedAt,
          fareBeforeWalletBenefitClp: rideRequests.fareBeforeWalletBenefitClp,
          status:             rideRequests.status,
          requestedAt:        rideRequests.requestedAt,
          acceptedAt:         rideRequests.acceptedAt,
          enRouteAt:          rideRequests.enRouteAt,
          arrivedAt:          rideRequests.arrivedAt,
          startedAt:          rideRequests.startedAt,
          completedAt:        rideRequests.completedAt,
          cancelledAt:        rideRequests.cancelledAt,
          cancellationReason: rideRequests.cancellationReason,
          cancelledByUserId:  rideRequests.cancelledByUserId,
          cancelledByRole:    rideRequests.cancelledByRole,
          createdAt:          rideRequests.createdAt,
          updatedAt:          rideRequests.updatedAt,
          isOfflineBooking:   rideRequests.isOfflineBooking,
          driverName:         driver.name,
          driverPhone:        driverProfiles.phone,
          driverVehicleBrand: driverProfiles.vehicleBrand,
          driverVehicleModel: driverProfiles.vehicleModel,
          driverVehicleYear:  driverProfiles.vehicleYear,
          driverVehiclePlate: driverProfiles.vehiclePlate,
          driverVehicleColor: driverProfiles.vehicleColor,
        })
        .from(rideRequests)
        .leftJoin(driver, eq(rideRequests.driverUserId, driver.id))
        .leftJoin(driverProfiles, eq(rideRequests.driverUserId, driverProfiles.userId))
        .where(eq(rideRequests.passengerUserId, passengerUserId))
        .orderBy(desc(rideRequests.requestedAt));

      // Collect unique driverUserIds that are not null
      const driverIds = [...new Set(rows.map((r) => r.driverUserId).filter((id): id is string => id != null))];

      // Fetch AVG/COUNT ratings for each driver in one query
      const ratingMap = new Map<string, { average: number | null; count: number }>();
      if (driverIds.length > 0) {
        const ratingRows = await db
          .select({
            ratedUserId:    rideRatings.ratedUserId,
            avgRating:      avg(rideRatings.rating),
            countRating:    count(rideRatings.rating),
          })
          .from(rideRatings)
          .where(inArray(rideRatings.ratedUserId, driverIds))
          .groupBy(rideRatings.ratedUserId);

        for (const r of ratingRows) {
          ratingMap.set(r.ratedUserId, {
            average: r.avgRating != null ? parseFloat(r.avgRating) : null,
            count:   Number(r.countRating),
          });
        }
      }

      return rows.map((r) => {
        const ratingInfo = r.driverUserId != null ? (ratingMap.get(r.driverUserId) ?? { average: null, count: 0 }) : { average: null, count: 0 };
        return {
          ...r,
          driverRatingAverage: ratingInfo.average,
          driverRatingCount:   ratingInfo.count,
          driverVehicleBrand:  r.driverVehicleBrand ?? null,
          driverVehicleModel:  r.driverVehicleModel ?? null,
          driverVehicleYear:   r.driverVehicleYear ?? null,
          driverVehiclePlate:  r.driverVehiclePlate ?? null,
          driverVehicleColor:  r.driverVehicleColor ?? null,
        } as RideWithDriverName;
      });
    } catch (err) {
      throw AppError.internal(`Failed to query ride requests with driver: ${String(err)}`);
    }
  }

  async findByIdAndPassenger(id: string, passengerUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .select()
        .from(rideRequests)
        .where(and(eq(rideRequests.id, id), eq(rideRequests.passengerUserId, passengerUserId)))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query ride request: ${String(err)}`);
    }
  }

  async create(
    passengerUserId: string,
    originText: string,
    destinationText: string,
    notes: string | null,
    estimatedFareClp: number,
  ): Promise<RideRequest> {
    const result = await this.createWithApprovedPolicyCharges(
      passengerUserId,
      originText,
      destinationText,
      notes,
      estimatedFareClp,
    );

    return result.ride;
  }

  /**
   * Crea el viaje y adjunta, dentro de la misma transacción, todos los cargos
   * aprobados y pendientes del mismo usuario.
   *
   * El frontend nunca es la autoridad del cargo. El monto final persistido en
   * ride_requests.estimated_fare_clp se calcula en el backend.
   */
  async createWithApprovedPolicyCharges(
    passengerUserId: string,
    originText: string,
    destinationText: string,
    notes: string | null,
    baseEstimatedFareClp: number,
    initialStatus: "requested" | "pending_payment" = "requested",
    options: {
      paymentMethod?: "cash" | "card";
      paymentProvider?: string | null;
      useWalletBenefit?: boolean;
    } = {},
  ): Promise<RideCreatedWithPolicyCharges> {
    try {
      return await db.transaction(async (tx) => {
        // Serializa creación y consumo de saldo por cuenta. Dos solicitudes
        // simultáneas nunca pueden gastar el mismo Beneficio ni adjuntar el
        // mismo cargo administrativo.
        await tx.execute(
          sql`select id from users where id = ${passengerUserId} for update`,
        );

        const approvedCharges = await tx
          .select()
          .from(ridePolicyCharges)
          .where(
            and(
              eq(ridePolicyCharges.ownerUserId, passengerUserId),
              eq(
                ridePolicyCharges.status,
                "approved_pending_next_ride",
              ),
              isNull(ridePolicyCharges.appliedToRideId),
            ),
          )
          .orderBy(asc(ridePolicyCharges.createdAt));

        const appliedChargesTotalClp = approvedCharges.reduce(
          (sum, charge) =>
            sum +
            Math.max(
              0,
              Math.round(
                Number(
                  charge.approvedAmountClp ??
                    charge.calculatedAmountClp ??
                    0,
                ),
              ),
            ),
          0,
        );

        const fareBeforeWalletBenefitClp = roundFareUpTo500(
          baseEstimatedFareClp + appliedChargesTotalClp,
        );

        const walletBenefitRequested = options.useWalletBenefit === true;

        if (
          walletBenefitRequested &&
          options.paymentMethod !== "cash"
        ) {
          throw AppError.internal(
            "Wallet benefits can only be used on cash rides.",
          );
        }

        let walletBenefitAppliedClp = 0;
        let walletBenefitRemainingClp = 0;
        let walletId: string | null = null;
        let walletBalanceBeforeClp = 0;

        if (walletBenefitRequested) {
          // La billetera puede no existir todavía. En ese caso el saldo es 0.
          await tx.execute(
            sql`select id from wallets where user_id = ${passengerUserId} for update`,
          );

          const wallet = (
            await tx
              .select()
              .from(wallets)
              .where(eq(wallets.userId, passengerUserId))
              .limit(1)
          )[0];

          if (wallet && wallet.status === "active") {
            walletId = wallet.id;
            walletBalanceBeforeClp = Math.max(
              0,
              Math.round(wallet.balance),
            );
            walletBenefitAppliedClp = Math.min(
              walletBalanceBeforeClp,
              fareBeforeWalletBenefitClp,
            );
            walletBenefitRemainingClp =
              walletBalanceBeforeClp - walletBenefitAppliedClp;
          }
        }

        const finalEstimatedFareClp = Math.max(
          0,
          fareBeforeWalletBenefitClp - walletBenefitAppliedClp,
        );

        const [ride] = await tx
          .insert(rideRequests)
          .values({
            passengerUserId,
            originText,
            destinationText,
            notes,
            estimatedFareClp: finalEstimatedFareClp,
            paymentMethod: options.paymentMethod ?? null,
            paymentProvider: options.paymentProvider ?? null,
            walletBenefitRequested,
            walletBenefitAppliedClp,
            fareBeforeWalletBenefitClp,
            status: initialStatus,
          })
          .returning();

        if (!ride) {
          throw AppError.internal("Insert returned no rows.");
        }

        if (walletId && walletBenefitAppliedClp > 0) {
          const now = new Date();

          const [updatedWallet] = await tx
            .update(wallets)
            .set({
              balance: walletBenefitRemainingClp,
              updatedAt: now,
            })
            .where(eq(wallets.id, walletId))
            .returning();

          if (!updatedWallet) {
            throw AppError.internal(
              "Wallet update returned no rows while applying benefit.",
            );
          }

          await tx.insert(transactions).values({
            walletId,
            userId: passengerUserId,
            rideId: ride.id,
            type: "benefit_use",
            amount: -walletBenefitAppliedClp,
            currency: "CLP",
            status: "completed",
            provider: "rapago",
            providerTransactionId: `benefit-use:${ride.id}`,
            description:
              "Beneficio aplicado al viaje en efectivo de la misma cuenta",
            metadata: {
              source: "cash_overpayment_benefit",
              exclusiveToOwner: true,
              cashRideOnly: true,
              balanceBeforeClp: walletBalanceBeforeClp,
              appliedClp: walletBenefitAppliedClp,
              balanceAfterClp: walletBenefitRemainingClp,
              fareBeforeBenefitClp: fareBeforeWalletBenefitClp,
              fareAfterBenefitClp: finalEstimatedFareClp,
            },
          });
        }

        if (approvedCharges.length > 0) {
          const now = new Date();
          const chargeIds = approvedCharges.map((charge) => charge.id);

          await tx
            .update(ridePolicyCharges)
            .set({
              status: "attached_to_next_ride",
              appliedToRideId: ride.id,
              appliedAt: now,
              updatedAt: now,
            })
            .where(
              and(
                inArray(ridePolicyCharges.id, chargeIds),
                eq(
                  ridePolicyCharges.status,
                  "approved_pending_next_ride",
                ),
                isNull(ridePolicyCharges.appliedToRideId),
              ),
            );
        }

        return {
          ride,
          appliedCharges: approvedCharges,
          appliedChargesTotalClp,
          fareBeforeWalletBenefitClp,
          walletBenefitRequested,
          walletBenefitAppliedClp,
          walletBenefitRemainingClp,
        };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to create ride request with policy charges and benefits: ${String(err)}`,
      );
    }
  }

  async findById(id: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.id, id))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query ride request: ${String(err)}`);
    }
  }

  async findByDriverId(driverUserId: string): Promise<RideRequest[]> {
    try {
      return await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.driverUserId, driverUserId))
        .orderBy(desc(rideRequests.acceptedAt));
    } catch (err) {
      throw AppError.internal(`Failed to query driver rides: ${String(err)}`);
    }
  }

  async findAvailable(): Promise<RideRequest[]> {
    try {
      return await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.status, "requested"))
        .orderBy(desc(rideRequests.requestedAt));
    } catch (err) {
      throw AppError.internal(`Failed to query available rides: ${String(err)}`);
    }
  }

  /**
   * Atomically accept a ride only when it is still in 'requested' status.
   * Returns null if no row was updated (status already changed — race condition).
   */
  async accept(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      return await db.transaction(async (tx) => {
        const acceptedAt = new Date();
        const rows = await tx
          .update(rideRequests)
          .set({
            status: "accepted",
            driverUserId,
            acceptedAt,
            updatedAt: acceptedAt,
          })
          .where(
            and(
              eq(rideRequests.id, id),
              eq(rideRequests.status, "requested"),
            ),
          )
          .returning();

        const accepted = rows[0] ?? null;
        if (!accepted) return null;

        await tx
          .insert(rideDriverAssignments)
          .values({
            rideRequestId: accepted.id,
            driverUserId,
            acceptedAt,
            outcome: "active",
          })
          .onConflictDoNothing();

        return accepted;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to accept ride request: ${String(err)}`);
    }
  }

  /**
   * Atomically complete a ride only when status='in_progress' AND driver matches.
   * Returns null if no row was updated.
   */
  async complete(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      return await db.transaction(async (tx) => {
        const completedAt = new Date();
        const rows = await tx
          .update(rideRequests)
          .set({
            status: "completed",
            completedAt,
            updatedAt: completedAt,
          })
          .where(and(
            eq(rideRequests.id, id),
            eq(rideRequests.status, "in_progress"),
            eq(rideRequests.driverUserId, driverUserId),
          ))
          .returning();

        const completed = rows[0] ?? null;
        if (!completed) return null;

        const activeRows = await tx
          .select()
          .from(rideDriverAssignments)
          .where(
            and(
              eq(rideDriverAssignments.rideRequestId, id),
              eq(rideDriverAssignments.driverUserId, driverUserId),
              eq(rideDriverAssignments.outcome, "active"),
              isNull(rideDriverAssignments.endedAt),
            ),
          )
          .orderBy(desc(rideDriverAssignments.acceptedAt))
          .limit(1);

        const active = activeRows[0];
        if (active) {
          const elapsedSeconds = Math.max(
            0,
            Math.floor(
              (completedAt.getTime() - active.acceptedAt.getTime()) / 1000,
            ),
          );
          await tx
            .update(rideDriverAssignments)
            .set({
              endedAt: completedAt,
              elapsedSeconds,
              outcome: "completed",
              cancellationEvent: "ride_completed",
              updatedAt: completedAt,
            })
            .where(eq(rideDriverAssignments.id, active.id));
        }

        return completed;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to complete ride: ${String(err)}`);
    }
  }

  /**
   * Atomically mark a ride en-route: accepted → driver_en_route.
   * Returns null if no row was updated.
   */
  async markEnRoute(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "driver_en_route", enRouteAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "accepted"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark ride en-route: ${String(err)}`);
    }
  }

  /**
   * Atomically mark a ride arrived: driver_en_route → driver_arrived.
   * Returns null if no row was updated.
   */
  async markArrived(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "driver_arrived", arrivedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "driver_en_route"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark ride arrived: ${String(err)}`);
    }
  }

  /**
   * Atomically start a ride only when status='driver_arrived' AND driver matches.
   * Returns null if no row was updated.
   */
  async start(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "driver_arrived"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to start ride: ${String(err)}`);
    }
  }

  /**
   * Atomically cancel a ride while it is accepted or the driver is still travelling to the pickup.
   * Returns null if no row was updated (status changed concurrently).
   */
  async cancelAccepted(
    id: string,
    cancelledByUserId: string,
    cancelledByRole: string,
    cancellationReason: string | null,
    compliance?: {
      cancellationEvent?: string | null;
      location?: {
        lat: number;
        lng: number;
        accuracyMeters?: number | null;
        capturedAt?: Date | null;
      } | null;
    },
  ): Promise<RideRequest | null> {
    try {
      return await db.transaction(async (tx) => {
        const changedAt = new Date();
        const driverIsCancelling = cancelledByRole === "driver";

        const rows = await tx
          .update(rideRequests)
          .set(
            driverIsCancelling
              ? {
                  // El conductor abandona su asignación, pero la solicitud del
                  // pasajero sigue activa y vuelve a la lista disponible.
                  status: "requested",
                  driverUserId: null,
                  acceptedAt: null,
                  enRouteAt: null,
                  arrivedAt: null,
                  cancelledAt: null,
                  cancelledByUserId: null,
                  cancelledByRole: null,
                  cancellationReason: null,
                  updatedAt: changedAt,
                }
              : {
                  status: "cancelled",
                  cancelledAt: changedAt,
                  cancelledByUserId,
                  cancelledByRole,
                  cancellationReason,
                  updatedAt: changedAt,
                },
          )
          .where(
            and(
              eq(rideRequests.id, id),
              inArray(rideRequests.status, [
                "accepted",
                "driver_en_route",
                "driver_arrived",
              ]),
            ),
          )
          .returning();

        const changedRide = rows[0] ?? null;
        if (!changedRide) return null;

        const assignmentDriverUserId = driverIsCancelling
          ? cancelledByUserId
          : changedRide.driverUserId;

        if (assignmentDriverUserId) {
          const activeRows = await tx
            .select()
            .from(rideDriverAssignments)
            .where(
              and(
                eq(rideDriverAssignments.rideRequestId, id),
                eq(
                  rideDriverAssignments.driverUserId,
                  assignmentDriverUserId,
                ),
                eq(rideDriverAssignments.outcome, "active"),
                isNull(rideDriverAssignments.endedAt),
              ),
            )
            .orderBy(desc(rideDriverAssignments.acceptedAt))
            .limit(1);

          const active = activeRows[0];
          if (active) {
            const elapsedSeconds = Math.max(
              0,
              Math.floor(
                (changedAt.getTime() - active.acceptedAt.getTime()) /
                  1000,
              ),
            );

            await tx
              .update(rideDriverAssignments)
              .set({
                endedAt: changedAt,
                elapsedSeconds,
                outcome: "cancelled",
                cancellationReason,
                cancelledByUserId,
                cancelledByRole,
                cancellationEvent:
                  compliance?.cancellationEvent ??
                  `ride_cancelled_by_${cancelledByRole}`,
                locationLat: compliance?.location?.lat ?? null,
                locationLng: compliance?.location?.lng ?? null,
                locationAccuracyMeters:
                  compliance?.location?.accuracyMeters ?? null,
                locationCapturedAt:
                  compliance?.location?.capturedAt ??
                  (compliance?.location ? changedAt : null),
                updatedAt: changedAt,
              })
              .where(eq(rideDriverAssignments.id, active.id));
          }
        }

        if (driverIsCancelling) {
          return changedRide;
        }

        return restoreAppliedWalletBenefit(
          tx,
          changedRide,
          changedAt,
          "ride_cancelled",
        );
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to cancel accepted ride: ${String(err)}`,
      );
    }
  }

  /**
   * Publica el viaje solo después de que el backend recibió un pago aprobado.
   * La condición status='pending_payment' evita activaciones dobles y hace la
   * operación idempotente ante webhooks repetidos.
   */
  /**
   * Activa RapaGo más veloz exactamente una vez y suma el recargo al total real.
   * El marcador en notes hace que los webhooks repetidos sean idempotentes.
   */
  async activateFastSearch(
    id: string,
    feeClp: number,
    paymentMethod: "cash" | "card",
  ): Promise<RideRequest | null> {
    try {
      const safeFeeClp = Math.max(0, Math.round(Number(feeClp)));
      if (safeFeeClp <= 0) return this.findById(id);

      const activatedAt = new Date();
      const marker = "RAPAGO_FAST_SEARCH_ACTIVE: true";
      const noteBlock = [
        marker,
        `RAPAGO_FAST_SEARCH_FEE_CLP: ${safeFeeClp}`,
        `RAPAGO_FAST_SEARCH_PAYMENT_METHOD: ${paymentMethod}`,
        "RAPAGO_FAST_SEARCH_PAYMENT_STATUS: approved",
        `RAPAGO_FAST_SEARCH_ACTIVATED_AT: ${activatedAt.toISOString()}`,
        `RapaGo más veloz: incluido en el total. Recargo: $${safeFeeClp.toLocaleString("es-CL")} CLP.`,
      ].join("\n");

      const [updated] = await db
        .update(rideRequests)
        .set({
          estimatedFareClp: sql<number>`(ceil((coalesce(${rideRequests.estimatedFareClp}, 0) + ${safeFeeClp})::numeric / 500) * 500)::integer`,
          notes: sql<string>`concat_ws(E'\\n', nullif(${rideRequests.notes}, ''), ${noteBlock})`,
          updatedAt: activatedAt,
        })
        .where(
          and(
            eq(rideRequests.id, id),
            sql`coalesce(${rideRequests.notes}, '') not like ${`%${marker}%`}`,
          ),
        )
        .returning();

      return updated ?? this.findById(id);
    } catch (err) {
      throw AppError.internal(
        `Failed to activate RapaGo fast search: ${String(err)}`,
      );
    }
  }

  async activateAfterApprovedPayment(id: string): Promise<RideRequest | null> {
    try {
      const [row] = await db
        .update(rideRequests)
        .set({
          status: "requested",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rideRequests.id, id),
            eq(rideRequests.status, "pending_payment"),
          ),
        )
        .returning();

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to activate ride after approved payment: ${String(err)}`,
      );
    }
  }

  /**
   * Cierra una solicitud que nunca recibió un pago aprobado. Nunca toca viajes
   * ya publicados, aceptados o iniciados.
   */
  async cancelPendingPayment(
    id: string,
    cancellationReason: string,
  ): Promise<RideRequest | null> {
    try {
      const now = new Date();
      const [row] = await db
        .update(rideRequests)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelledByRole: "payment",
          cancellationReason,
          updatedAt: now,
        })
        .where(
          and(
            eq(rideRequests.id, id),
            eq(rideRequests.status, "pending_payment"),
          ),
        )
        .returning();

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to cancel pending-payment ride: ${String(err)}`,
      );
    }
  }


  async findPolicyChargeById(id: string): Promise<RidePolicyCharge | null> {
    try {
      const [row] = await db
        .select()
        .from(ridePolicyCharges)
        .where(eq(ridePolicyCharges.id, id))
        .limit(1);

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query ride policy charge: ${String(err)}`,
      );
    }
  }

  async findPolicyChargeBySourceRideAndType(
    sourceRideId: string,
    type: string,
  ): Promise<RidePolicyCharge | null> {
    try {
      const [row] = await db
        .select()
        .from(ridePolicyCharges)
        .where(
          and(
            eq(ridePolicyCharges.sourceRideId, sourceRideId),
            eq(ridePolicyCharges.type, type),
          ),
        )
        .limit(1);

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query ride policy charge by source ride: ${String(err)}`,
      );
    }
  }

  async createPolicyCharge(
    data: NewRidePolicyCharge,
  ): Promise<RidePolicyCharge> {
    try {
      const existing = await this.findPolicyChargeBySourceRideAndType(
        data.sourceRideId,
        data.type,
      );

      if (existing) return existing;

      const [row] = await db
        .insert(ridePolicyCharges)
        .values(data)
        .returning();

      if (!row) {
        throw AppError.internal("Policy charge insert returned no rows.");
      }

      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;

      // La restricción única evita duplicar el mismo tipo de cargo por viaje.
      const existing = await this.findPolicyChargeBySourceRideAndType(
        data.sourceRideId,
        data.type,
      );

      if (existing) return existing;

      throw AppError.internal(
        `Failed to create ride policy charge: ${String(err)}`,
      );
    }
  }

  async listApprovedPolicyChargesForOwner(
    ownerUserId: string,
  ): Promise<RidePolicyCharge[]> {
    try {
      return await db
        .select()
        .from(ridePolicyCharges)
        .where(
          and(
            eq(ridePolicyCharges.ownerUserId, ownerUserId),
            eq(
              ridePolicyCharges.status,
              "approved_pending_next_ride",
            ),
            isNull(ridePolicyCharges.appliedToRideId),
          ),
        )
        .orderBy(asc(ridePolicyCharges.createdAt));
    } catch (err) {
      throw AppError.internal(
        `Failed to list approved policy charges: ${String(err)}`,
      );
    }
  }

  async listAllPolicyCharges(): Promise<RidePolicyChargeWithOwner[]> {
    try {
      const owner = alias(users, "policy_charge_owner");

      const rows = await db
        .select({
          charge: ridePolicyCharges,
          ownerName: owner.name,
          ownerEmail: owner.email,
        })
        .from(ridePolicyCharges)
        .leftJoin(owner, eq(ridePolicyCharges.ownerUserId, owner.id))
        .orderBy(desc(ridePolicyCharges.createdAt));

      return rows.map((row) => ({
        ...row.charge,
        ownerName: row.ownerName ?? null,
        ownerEmail: row.ownerEmail ?? null,
      }));
    } catch (err) {
      throw AppError.internal(
        `Failed to list ride policy charges: ${String(err)}`,
      );
    }
  }

  async approvePolicyCharge(input: {
    id: string;
    reviewedByUserId: string;
    approvedAmountClp: number;
    adminDecisionReason: string | null;
  }): Promise<RidePolicyCharge | null> {
    try {
      const [row] = await db
        .update(ridePolicyCharges)
        .set({
          status: "approved_pending_next_ride",
          approvedAmountClp: input.approvedAmountClp,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          adminDecisionReason: input.adminDecisionReason,
          appliedToRideId: null,
          appliedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ridePolicyCharges.id, input.id),
            inArray(ridePolicyCharges.status, [
              "pending_admin_review",
              "approved_pending_next_ride",
            ]),
          ),
        )
        .returning();

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to approve ride policy charge: ${String(err)}`,
      );
    }
  }

  async waivePolicyCharge(input: {
    id: string;
    reviewedByUserId: string;
    adminDecisionReason: string;
  }): Promise<RidePolicyCharge | null> {
    try {
      const [row] = await db
        .update(ridePolicyCharges)
        .set({
          status: "waived",
          approvedAmountClp: 0,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          adminDecisionReason: input.adminDecisionReason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ridePolicyCharges.id, input.id),
            inArray(ridePolicyCharges.status, [
              "pending_admin_review",
              "approved_pending_next_ride",
            ]),
          ),
        )
        .returning();

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to waive ride policy charge: ${String(err)}`,
      );
    }
  }

  async markNoShow(
    id: string,
    driverUserId: string,
  ): Promise<RideRequest | null> {
    try {
      return await db.transaction(async (tx) => {
        const now = new Date();
        const reason =
          "No show: pasajero no se presentó después de 5 minutos.";

        const [row] = await tx
          .update(rideRequests)
          .set({
            status: "cancelled",
            cancelledAt: now,
            cancelledByUserId: driverUserId,
            cancelledByRole: "driver_no_show",
            cancellationReason: reason,
            updatedAt: now,
          })
          .where(
            and(
              eq(rideRequests.id, id),
              eq(rideRequests.status, "driver_arrived"),
              eq(rideRequests.driverUserId, driverUserId),
            ),
          )
          .returning();

        if (!row) return null;

        const activeRows = await tx
          .select()
          .from(rideDriverAssignments)
          .where(
            and(
              eq(rideDriverAssignments.rideRequestId, id),
              eq(rideDriverAssignments.driverUserId, driverUserId),
              eq(rideDriverAssignments.outcome, "active"),
              isNull(rideDriverAssignments.endedAt),
            ),
          )
          .orderBy(desc(rideDriverAssignments.acceptedAt))
          .limit(1);

        const active = activeRows[0];
        if (active) {
          const elapsedSeconds = Math.max(
            0,
            Math.floor((now.getTime() - active.acceptedAt.getTime()) / 1000),
          );
          await tx
            .update(rideDriverAssignments)
            .set({
              endedAt: now,
              elapsedSeconds,
              outcome: "no_show",
              cancellationReason: reason,
              cancelledByUserId: driverUserId,
              cancelledByRole: "driver_no_show",
              cancellationEvent: "driver_declared_no_show",
              updatedAt: now,
            })
            .where(eq(rideDriverAssignments.id, active.id));
        }

        return restoreAppliedWalletBenefit(
          tx,
          row,
          now,
          "passenger_no_show",
        );
      });
    } catch (err) {
      throw AppError.internal(
        `Failed to mark ride as no show: ${String(err)}`,
      );
    }
  }

  async createOfflineRide(data: {
    passengerUserId:      string;
    originText:           string;
    destinationText:      string;
    notes:                string | null;
    estimatedFareClp:     number;
    offlinePassengerName: string;
    offlinePassengerPhone: string;
    offlinePassengerEmail?: string | null;
  }): Promise<RideRequest> {
    try {
      const rows = await db
        .insert(rideRequests)
        .values({
          passengerUserId:      data.passengerUserId,
          originText:           data.originText,
          destinationText:      data.destinationText,
          notes:                data.notes,
          estimatedFareClp:     roundFareUpTo500(data.estimatedFareClp),
          status:               "requested",
          isOfflineBooking:     true,
          offlinePassengerName:  data.offlinePassengerName,
          offlinePassengerPhone: data.offlinePassengerPhone,
          offlinePassengerEmail: data.offlinePassengerEmail ?? null,
        })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create offline ride request: ${String(err)}`);
    }
  }

  async cancel(
    id: string,
    cancelledByUserId?: string | null,
    cancelledByRole?: string | null,
    cancellationReason?: string | null,
  ): Promise<RideRequest> {
    try {
      return await db.transaction(async (tx) => {
        const cancelledAt = new Date();

        const [row] = await tx
          .update(rideRequests)
          .set({
            status: "cancelled",
            cancelledAt,
            cancelledByUserId: cancelledByUserId ?? null,
            cancelledByRole: cancelledByRole ?? null,
            cancellationReason: cancellationReason ?? null,
            updatedAt: cancelledAt,
          })
          .where(
            and(
              eq(rideRequests.id, id),
              inArray(rideRequests.status, [
                "requested",
                "pending_payment",
              ]),
            ),
          )
          .returning();

        if (!row) {
          throw AppError.internal("Update returned no rows.");
        }

        return restoreAppliedWalletBenefit(
          tx,
          row,
          cancelledAt,
          "ride_cancelled",
        );
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to cancel ride request: ${String(err)}`,
      );
    }
  }
}