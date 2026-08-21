import { eq, and, isNull, isNotNull, gte, inArray, notInArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { driverStatuses, driverProfiles, rideRequests, users } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { DriverStatus } from "../../db/schema/index.js";

/**
 * Candidato a preasignación encadenada: conductor con viaje activo (A) en un
 * estado donde ya tiene sentido ofrecerle un viaje en cola (B).
 *
 * Capacidades reales del perfil bloquean ofertas incompatibles.
 */
export interface QueueCandidateRow {
  driverUserId:            string;
  currentRideId:           string;
  currentRideStatus:       string;
  currentRideDestinationLat: number;
  currentRideDestinationLng: number;
  currentLat:              number;
  currentLng:              number;
  locationUpdatedAt:       Date | null;
  vehicleCategory:         string | null;
  capabilityXl:            boolean;
  capabilityExtraLuggage:  boolean;
  capabilityComfort:       boolean;
  vehicleYear:             number | null;
}

export interface AvailableDriverCandidate {
  driverUserId:       string;
  currentLat:         number;
  currentLng:         number;
  locationUpdatedAt:  Date;
  lastSeenAt:         Date;
  currentZone:        string | null;
}

export interface BusyDriverCandidate {
  driverUserId:       string;
  currentLat:         number;
  currentLng:         number;
  locationUpdatedAt:  Date;
  lastSeenAt:         Date;
  currentRideId:      string;
}

export class DriverStatusRepository {
  async findByDriverId(driverUserId: string): Promise<DriverStatus | null> {
    try {
      const rows = await db.select().from(driverStatuses)
        .where(eq(driverStatuses.driverUserId, driverUserId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query driver status: ${String(err)}`);
    }
  }

  async upsert(driverUserId: string, availability: string, currentZone?: string | null): Promise<DriverStatus> {
    try {
      const setValues: Partial<typeof driverStatuses.$inferInsert> = {
        availability,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      };
      if (currentZone !== undefined) setValues.currentZone = currentZone;

      const rows = await db
        .insert(driverStatuses)
        .values({ driverUserId, availability, currentZone: currentZone ?? null, lastSeenAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: setValues,
        })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Upsert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to upsert driver status: ${String(err)}`);
    }
  }

  async setBusy(driverUserId: string, rideId: string): Promise<void> {
    try {
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "busy", currentRideId: rideId, lastSeenAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { availability: "busy", currentRideId: rideId, updatedAt: new Date() },
        });
    } catch (err) {
      throw AppError.internal(`Failed to set driver busy: ${String(err)}`);
    }
  }


  /**
   * Reclama el slot de viaje ACTIVO de forma atómica.
   *
   * Nunca confía en que la UI evite que un conductor acepte dos viajes a la
   * vez — la garantía real vive en la BD. Es un upsert con una condición en
   * el UPDATE (`setWhere`): si no existe fila para el conductor, la inserción
   * la crea; si existe pero current_ride_id ya está ocupado, el UPDATE no se
   * aplica y no se retorna ninguna fila. `null` significa "el conductor ya
   * tenía un viaje activo — no reclamado".
   */
  async claimCurrentRide(driverUserId: string, rideId: string): Promise<DriverStatus | null> {
    try {
      const now = new Date();
      const rows = await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "busy", currentRideId: rideId, lastSeenAt: now })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { availability: "busy", currentRideId: rideId, updatedAt: now },
          setWhere: isNull(driverStatuses.currentRideId),
        })
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to claim current ride: ${String(err)}`);
    }
  }

  /**
   * Libera un slot de viaje ACTIVO reclamado por error (p. ej. el ride ya
   * había sido tomado por otro conductor cuando accept() corrió después del
   * claim). Solo libera si current_ride_id sigue siendo exactamente ese ride
   * — evita pisar un claim legítimo posterior.
   */
  async releaseCurrentRideClaim(driverUserId: string, rideId: string): Promise<void> {
    try {
      const now = new Date();
      await db
        .update(driverStatuses)
        .set({ availability: "available", currentRideId: null, updatedAt: now })
        .where(
          and(
            eq(driverStatuses.driverUserId, driverUserId),
            eq(driverStatuses.currentRideId, rideId),
          ),
        );
    } catch (err) {
      throw AppError.internal(`Failed to release current ride claim: ${String(err)}`);
    }
  }

  /**
   * Reclama el slot de viaje EN COLA de forma atómica.
   *
   * Solo puede reclamarse si el conductor YA tiene un viaje activo
   * (current_ride_id no nulo) y todavía no tiene ninguno en cola
   * (queued_ride_id nulo). A diferencia de claimCurrentRide, no necesita
   * upsert: si current_ride_id no es nulo, la fila ya existe por definición
   * (setBusy/claimCurrentRide la crearon antes).
   */
  async claimQueuedRide(driverUserId: string, rideId: string): Promise<DriverStatus | null> {
    try {
      const now = new Date();
      const rows = await db
        .update(driverStatuses)
        .set({ queuedRideId: rideId, updatedAt: now })
        .where(
          and(
            eq(driverStatuses.driverUserId, driverUserId),
            isNotNull(driverStatuses.currentRideId),
            isNull(driverStatuses.queuedRideId),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to claim queued ride: ${String(err)}`);
    }
  }

  /**
   * Libera un slot de viaje EN COLA reclamado por error (p. ej. el ride ya
   * había sido tomado cuando acceptAsQueued() corrió después del claim).
   * Solo libera si queued_ride_id sigue siendo exactamente ese ride.
   */
  async releaseQueuedRideClaim(driverUserId: string, rideId: string): Promise<void> {
    try {
      const now = new Date();
      await db
        .update(driverStatuses)
        .set({ queuedRideId: null, updatedAt: now })
        .where(
          and(
            eq(driverStatuses.driverUserId, driverUserId),
            eq(driverStatuses.queuedRideId, rideId),
          ),
        );
    } catch (err) {
      throw AppError.internal(`Failed to release queued ride claim: ${String(err)}`);
    }
  }

  /**
   * Lista conductores candidatos a recibir una oferta de preasignación
   * encadenada: tienen un viaje activo (A) en un estado donde tiene sentido
   * ofrecerles el siguiente (driver_arrived o in_progress), no tienen ya un
   * viaje en cola, no están unavailable, y tienen ubicación conocida.
   *
   * `excludeDriverIds` se usa para no volver a considerar conductores que ya
   * recibieron una oferta (pending, rechazada o expirada) para el mismo ride B.
   *
   * Filtro barato a nivel BD — no calcula distancia ni ETA aquí; eso lo hace
   * rideQueueMatch() sobre cada fila devuelta.
   */
  async findQueueCandidates(excludeDriverIds: string[] = []): Promise<QueueCandidateRow[]> {
    try {
      const conditions = [
        isNotNull(driverStatuses.currentRideId),
        isNull(driverStatuses.queuedRideId),
        isNotNull(driverStatuses.currentLat),
        isNotNull(driverStatuses.currentLng),
        eq(driverStatuses.availability, "busy"),
        inArray(rideRequests.status, ["driver_arrived", "in_progress"]),
      ];
      if (excludeDriverIds.length > 0) {
        conditions.push(notInArray(driverStatuses.driverUserId, excludeDriverIds));
      }

      const rows = await db
        .select({
          driverUserId:              driverStatuses.driverUserId,
          currentRideId:             driverStatuses.currentRideId,
          currentRideStatus:         rideRequests.status,
          currentRideDestinationLat: rideRequests.destinationLat,
          currentRideDestinationLng: rideRequests.destinationLng,
          currentLat:                driverStatuses.currentLat,
          currentLng:                driverStatuses.currentLng,
          locationUpdatedAt:         driverStatuses.locationUpdatedAt,
          vehicleCategory:           driverProfiles.vehicleCategory,
          capabilityXl:              driverProfiles.capabilityXl,
          capabilityExtraLuggage:    driverProfiles.capabilityExtraLuggage,
          capabilityComfort:         driverProfiles.capabilityComfort,
          vehicleYear:               driverProfiles.vehicleYear,
        })
        .from(driverStatuses)
        .innerJoin(rideRequests, eq(driverStatuses.currentRideId, rideRequests.id))
        .leftJoin(driverProfiles, eq(driverProfiles.userId, driverStatuses.driverUserId))
        .where(and(...conditions));

      return rows
        .filter((r) => r.currentRideId != null && r.currentRideDestinationLat != null && r.currentRideDestinationLng != null)
        .map((r) => ({
          driverUserId:              r.driverUserId,
          currentRideId:             r.currentRideId as string,
          currentRideStatus:         r.currentRideStatus,
          currentRideDestinationLat: r.currentRideDestinationLat as number,
          currentRideDestinationLng: r.currentRideDestinationLng as number,
          currentLat:                r.currentLat as number,
          currentLng:                r.currentLng as number,
          locationUpdatedAt:         r.locationUpdatedAt,
          vehicleCategory:           r.vehicleCategory ?? null,
          capabilityXl:              r.capabilityXl === true,
          capabilityExtraLuggage:    r.capabilityExtraLuggage === true,
          capabilityComfort:         r.capabilityComfort === true,
          vehicleYear:
            r.vehicleYear != null && Number.isFinite(Number(r.vehicleYear))
              ? Number(r.vehicleYear)
              : null,
        }));
    } catch (err) {
      throw AppError.internal(`Failed to query queue candidates: ${String(err)}`);
    }
  }

  /**
   * Transición atómica A→B de la preasignación encadenada (Fase 3).
   *
   * Se llama SIEMPRE después de que A ya quedó `completed` en su propia
   * transacción (ridesRepo.complete()) — nunca antes. Esta función sólo
   * decide qué pasa con el SIGUIENTE viaje del conductor, en su propia
   * transacción separada, con su propio conjunto de UPDATEs condicionales:
   *
   *   1. Relee driver_statuses. Si currentRideId ya no es `rideAId` (p. ej.
   *      esta función ya corrió antes para el mismo A, o el estado no
   *      corresponde), no hace nada — decision: "STATUS_MISMATCH".
   *   2. Si no hay queuedRideId, no hay nada que activar — "NO_QUEUED_RIDE".
   *   3. Intenta activar B con un UPDATE condicional
   *      (status='accepted' AND assignment_mode='queued_offer' AND
   *      queued_offer_driver_id=driver AND driver_user_id=driver). Si B fue
   *      cancelado, reasignado, o ya no es válido por cualquier motivo, el
   *      UPDATE afecta 0 filas — "QUEUED_RIDE_INVALID": se limpia
   *      queued_ride_id (referencia stale) en la misma transacción para que
   *      el conductor quede disponible normalmente.
   *   4. Si B se activó, mueve driver_statuses: current_ride_id→B,
   *      queued_ride_id→NULL, en la misma transacción — "TRANSITIONED".
   *
   * Todo dentro de una única transacción DB — nunca dos operaciones sueltas.
   * No hace nada fuera de BD (sin notificaciones, sin Klap): eso lo maneja
   * el caller después de que la transacción confirma, para no mantener una
   * transacción abierta esperando servicios externos.
   */
  async activateQueuedRideOrClearStale(
    driverUserId: string,
    rideAId: string,
  ): Promise<
    | { decision: "TRANSITIONED"; activatedRideId: string }
    | { decision: "STATUS_MISMATCH" | "NO_QUEUED_RIDE" }
    | { decision: "QUEUED_RIDE_INVALID"; staleRideId: string }
  > {
    try {
      return await db.transaction(async (tx) => {
        const statusRows = await tx
          .select()
          .from(driverStatuses)
          .where(eq(driverStatuses.driverUserId, driverUserId))
          .limit(1);
        const status = statusRows[0];

        if (!status || status.currentRideId !== rideAId) {
          return { decision: "STATUS_MISMATCH" as const };
        }

        const queuedRideId = status.queuedRideId;
        if (!queuedRideId) {
          return { decision: "NO_QUEUED_RIDE" as const };
        }

        const now = new Date();
        const activatedRows = await tx
          .update(rideRequests)
          .set({ status: "driver_en_route", enRouteAt: now, updatedAt: now })
          .where(
            and(
              eq(rideRequests.id, queuedRideId),
              eq(rideRequests.status, "accepted"),
              eq(rideRequests.assignmentMode, "queued_offer"),
              eq(rideRequests.queuedOfferDriverId, driverUserId),
              eq(rideRequests.driverUserId, driverUserId),
            ),
          )
          .returning();

        const activated = activatedRows[0] ?? null;

        if (!activated) {
          // B ya no es válido (cancelado, reasignado, estado distinto).
          // Limpia la referencia stale — nunca revive B.
          await tx
            .update(driverStatuses)
            .set({ queuedRideId: null, updatedAt: now })
            .where(
              and(
                eq(driverStatuses.driverUserId, driverUserId),
                eq(driverStatuses.queuedRideId, queuedRideId),
              ),
            );
          return { decision: "QUEUED_RIDE_INVALID" as const, staleRideId: queuedRideId };
        }

        await tx
          .update(driverStatuses)
          .set({
            currentRideId: queuedRideId,
            queuedRideId: null,
            availability: "busy",
            updatedAt: now,
          })
          .where(
            and(
              eq(driverStatuses.driverUserId, driverUserId),
              eq(driverStatuses.currentRideId, rideAId),
              eq(driverStatuses.queuedRideId, queuedRideId),
            ),
          );

        return { decision: "TRANSITIONED" as const, activatedRideId: queuedRideId };
      });
    } catch (err) {
      throw AppError.internal(`Failed to activate queued ride transition: ${String(err)}`);
    }
  }

  /**
   * Fase 5.2 — Resuelve un viaje B en cola cuando A termina de forma
   * ANORMAL (cancelación, no-show, reconciliación de estado stale), en vez
   * de completeRide(). Nunca puede quedar `current_ride_id = NULL` con
   * `queued_ride_id` todavía apuntando a una B accepted/queued_offer — esa
   * combinación dejaba a B huérfana y permitía que "resucitara" después de
   * un viaje C no relacionado (brecha crítica de la auditoría end-to-end).
   *
   * Estrategia B (reasignar, no cancelar): B vuelve a `requested` con
   * `assignment_mode='automatic'`, lista para el matching normal — nunca se
   * toca `payments` ni Klap, porque la autorización de B está atada a
   * `ride_request_id`, no al conductor.
   *
   * Todo en UNA transacción: relee driver_statuses, confirma que
   * current_ride_id sigue siendo la A que está terminando (si no, decisión
   * STATUS_MISMATCH — nada que hacer, evita pisar un estado más nuevo), y si
   * hay queued_ride_id, intenta el UPDATE condicional de B Y limpia
   * driver_statuses (current_ride_id + queued_ride_id) en el mismo commit.
   * Si B ya no es válida (otro proceso la resolvió en paralelo — carrera),
   * igual se limpia driver_statuses; nunca se deja el puntero stale.
   *
   * IMPORTANTE: si no había queued_ride_id, esta función NO escribe nada —
   * el caller sigue su camino normal existente (setAvailable /
   * clearStaleCurrentRide / releaseDriverAfterRide) sin ningún cambio de
   * comportamiento para el caso (mayoritario) sin cola.
   */
  async resolveQueuedRideOnAbnormalEnd(
    driverUserId: string,
    currentRideId: string,
  ): Promise<
    | { decision: "NO_QUEUED_RIDE" | "STATUS_MISMATCH" }
    | { decision: "RESOLVED"; releasedRideId: string }
    | { decision: "QUEUED_RIDE_ALREADY_INVALID"; staleRideId: string }
  > {
    try {
      return await db.transaction(async (tx) => {
        const statusRows = await tx
          .select()
          .from(driverStatuses)
          .where(eq(driverStatuses.driverUserId, driverUserId))
          .limit(1);
        const status = statusRows[0];

        if (!status || status.currentRideId !== currentRideId) {
          return { decision: "STATUS_MISMATCH" as const };
        }

        const queuedRideId = status.queuedRideId;
        if (!queuedRideId) {
          return { decision: "NO_QUEUED_RIDE" as const };
        }

        const now = new Date();
        const resetRows = await tx
          .update(rideRequests)
          .set({
            status: "requested",
            driverUserId: null,
            acceptedAt: null,
            enRouteAt: null,
            arrivedAt: null,
            cancelledAt: null,
            cancelledByUserId: null,
            cancelledByRole: null,
            cancellationReason: null,
            assignmentMode: "automatic",
            queuedOfferDriverId: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(rideRequests.id, queuedRideId),
              eq(rideRequests.status, "accepted"),
              eq(rideRequests.assignmentMode, "queued_offer"),
              eq(rideRequests.queuedOfferDriverId, driverUserId),
              eq(rideRequests.driverUserId, driverUserId),
            ),
          )
          .returning();

        const resolved = resetRows[0] ?? null;

        // Se limpia SIEMPRE driver_statuses cuando había queued_ride_id,
        // exista o no B todavía en un estado resoluble — nunca se deja el
        // puntero stale, ni siquiera si otro proceso ya la resolvió antes.
        await tx
          .update(driverStatuses)
          .set({ currentRideId: null, queuedRideId: null, updatedAt: now })
          .where(eq(driverStatuses.driverUserId, driverUserId));

        if (!resolved) {
          return { decision: "QUEUED_RIDE_ALREADY_INVALID" as const, staleRideId: queuedRideId };
        }

        return { decision: "RESOLVED" as const, releasedRideId: queuedRideId };
      });
    } catch (err) {
      throw AppError.internal(`Failed to resolve queued ride on abnormal end: ${String(err)}`);
    }
  }

  async setQueuedRide(driverUserId: string, rideId: string): Promise<void> {
    try {
      const now = new Date();
      await db
        .insert(driverStatuses)
        .values({
          driverUserId,
          availability: "busy",
          queuedRideId: rideId,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: {
            queuedRideId: rideId,
            updatedAt: now,
          },
        });
    } catch (err) {
      throw AppError.internal(`Failed to set queued ride: ${String(err)}`);
    }
  }

  async updateLocation(driverUserId: string, lat: number, lng: number): Promise<void> {
    try {
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "unavailable", currentLat: lat, currentLng: lng, locationUpdatedAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date(), updatedAt: new Date() },
        });
    } catch (err) {
      throw AppError.internal(`Failed to update driver location: ${String(err)}`);
    }
  }

  async setAvailable(driverUserId: string): Promise<void> {
    try {
      const now = new Date();
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "available", currentRideId: null, lastSeenAt: now })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { availability: "available", currentRideId: null, lastSeenAt: now, updatedAt: now },
        });
    } catch (err) {
      throw AppError.internal(`Failed to set driver available: ${String(err)}`);
    }
  }

  /**
   * Limpia un viaje fantasma guardado en driver_statuses.
   *
   * La tabla ride_requests es la fuente de verdad. Si ya no existe un viaje
   * aceptado/en ruta/llegado/en progreso, currentRideId no puede seguir
   * impidiendo que el conductor vuelva a ponerse Disponible.
   */
  async clearStaleCurrentRide(driverUserId: string): Promise<void> {
    try {
      const now = new Date();

      await db
        .update(driverStatuses)
        .set({
          availability: "unavailable",
          currentRideId: null,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(driverStatuses.driverUserId, driverUserId));
    } catch (err) {
      throw AppError.internal(
        `Failed to clear stale driver ride: ${String(err)}`,
      );
    }
  }

  /**
   * Deja al conductor fuera de la recepción de ofertas sin borrar un viaje
   * activo. Se utiliza al comenzar la franja legal de desconexión.
   */
  async setUnavailableForRest(driverUserId: string): Promise<void> {
    try {
      const current = await this.findByDriverId(driverUserId);

      // Si está terminando un viaje, conserva busy/currentRideId. El backend ya
      // bloqueará nuevas ofertas y activará las 12 horas al cerrar el servicio.
      if (current?.currentRideId) return;

      await db
        .insert(driverStatuses)
        .values({
          driverUserId,
          availability: "unavailable",
          currentRideId: null,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: {
            availability: "unavailable",
            currentRideId: null,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to set driver unavailable for rest: ${String(err)}`);
    }
  }
}
