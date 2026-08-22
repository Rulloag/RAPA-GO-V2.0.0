/**
 * Productor de ofertas de preasignación encadenada (Fase 2).
 *
 * Conecta rideQueueMatch() (Fase 1, motor puro) con createOffer()
 * (existente, hasta ahora sin caller) para ofrecer UN ride en cola a la vez
 * al mejor conductor candidato — nunca asigna el viaje directamente, sólo
 * crea una oferta que el conductor todavía debe aceptar/rechazar.
 *
 * Disparo (Fase 2, V1): sólo por evento — se invoca cuando existe un ride B
 * candidato a ofrecerse en cola (alta de un nuevo ride_request, o cuando una
 * oferta previa para el mismo ride se resolvió sin éxito: rechazo o
 * expiración detectada). No existe un scheduler/cron nuevo en esta fase: el
 * avance "oferta vencida → siguiente candidato" es LAZY, ocurre la próxima
 * vez que algo dispara al productor para ese ride (nueva oferta rechazada,
 * un caller que vuelva a intentar, o una futura Fase que agregue polling).
 * Ver expireStale() más abajo — ya existía sin caller periódico; aquí se
 * invoca al principio de cada intento para no dejar B bloqueado por una
 * oferta vencida de un intento anterior.
 *
 * Revalidación: justo antes de insertar la oferta se vuelve a comprobar que
 * el candidato sigue calificando (no se confía en el resultado calculado
 * segundos antes, ver paso 7 del pedido). La garantía dura final es el
 * índice único parcial `uq_driver_offer_pending` / `uq_ride_offer_pending`
 * en BD: si dos productores concurrentes intentan crear una oferta para el
 * mismo conductor o el mismo ride, sólo uno gana — el otro recibe un error
 * de violación de unicidad (23505) que se trata como "perdí la carrera" y
 * se avanza al siguiente candidato, nunca como un error interno genérico.
 */
import { RideAssignmentOffersRepository } from "./rideAssignmentOffers.repository.js";
import { RidesRepository } from "./rides.repository.js";
import { DriverStatusRepository } from "../drivers/driverStatus.repository.js";
import {
  evaluateQueueEligibility,
  estimateEtaMinutes,
  haversineDistanceKm,
  QUEUE_MATCH_CONFIG,
  type QueueMatchConfig,
} from "./rideQueueMatch.js";
import type { RideAssignmentOffer } from "../../db/schema/index.js";

const offersRepo = new RideAssignmentOffersRepository();
const ridesRepo = new RidesRepository();
const driverStatusRepo = new DriverStatusRepository();

const UNIQUE_VIOLATION_PG_CODE = "23505";

export type ProducerDecision =
  | "OFFER_CREATED"
  | "RIDE_NOT_REQUESTED"
  | "OFFER_ALREADY_PENDING"
  | "NO_ELIGIBLE_CANDIDATE"
  | "LOST_RACE_RETRY_EXHAUSTED";

export interface ProducerResult {
  decision: ProducerDecision;
  offerId: string | null;
  candidateDriverId: string | null;
  attemptOrder: number | null;
}

/** Log estructurado sin PII: nunca nombre, teléfono, correo, ni ruta completa de A. */
function logDecision(
  logger: { info: (obj: unknown, msg?: string) => void } | undefined,
  fields: {
    rideId: string;
    candidateDriverId: string | null;
    score: number | null;
    decision: string;
    reason: string | null;
    offerId: string | null;
    attemptOrder: number | null;
  },
): void {
  logger?.info(
    {
      event: "ride_queue_offer_producer",
      rideId: fields.rideId,
      candidateDriverId: fields.candidateDriverId,
      score: fields.score,
      decision: fields.decision,
      reason: fields.reason,
      offerId: fields.offerId,
      attemptOrder: fields.attemptOrder,
    },
    "ride_queue_offer_producer",
  );
}

export interface AttemptQueuedOfferOptions {
  now?: Date;
  config?: Partial<QueueMatchConfig>;
  logger?: { info: (obj: unknown, msg?: string) => void };
}

/**
 * Intenta crear UNA oferta de preasignación encadenada para el ride B dado.
 * Idempotente: si ya hay una oferta pending para el ride, no duplica.
 * Puro efecto colateral en BD — no lanza para casos de negocio esperados,
 * sólo para errores de infraestructura inesperados.
 */
export async function attemptQueuedOffer(
  rideRequestId: string,
  options: AttemptQueuedOfferOptions = {},
): Promise<ProducerResult> {
  const now = options.now ?? new Date();
  const config: QueueMatchConfig = { ...QUEUE_MATCH_CONFIG, ...options.config };

  // Limpieza perezosa: una oferta vencida de un intento anterior nunca debe
  // dejar bloqueado a este ride (uq_ride_offer_pending sólo bloquea 'pending').
  await offersRepo.expireStale(now);

  const ride = await ridesRepo.findById(rideRequestId);
  if (!ride || ride.status !== "requested") {
    logDecision(options.logger, {
      rideId: rideRequestId,
      candidateDriverId: null,
      score: null,
      decision: "RIDE_NOT_REQUESTED",
      reason: !ride ? "RIDE_NOT_FOUND" : `RIDE_STATUS_${ride.status}`,
      offerId: null,
      attemptOrder: null,
    });
    return { decision: "RIDE_NOT_REQUESTED", offerId: null, candidateDriverId: null, attemptOrder: null };
  }

  const existingPending = await offersRepo.findPendingByRideId(rideRequestId);
  if (existingPending) {
    logDecision(options.logger, {
      rideId: rideRequestId,
      candidateDriverId: existingPending.driverUserId,
      score: null,
      decision: "OFFER_ALREADY_PENDING",
      reason: null,
      offerId: existingPending.id,
      attemptOrder: existingPending.attemptOrder,
    });
    return {
      decision: "OFFER_ALREADY_PENDING",
      offerId: existingPending.id,
      candidateDriverId: existingPending.driverUserId,
      attemptOrder: existingPending.attemptOrder,
    };
  }

  const alreadyTriedDriverIds = await offersRepo.findDriverIdsByRideId(rideRequestId);
  const nextAttemptOrder = alreadyTriedDriverIds.length + 1;

  const rawCandidates = await driverStatusRepo.findQueueCandidates(alreadyTriedDriverIds);

  const ranked = rawCandidates
    .map((candidate) => {
      const currentTripRemainingMin = estimateEtaMinutes(
        haversineDistanceKm(
          candidate.currentLat,
          candidate.currentLng,
          candidate.currentRideDestinationLat,
          candidate.currentRideDestinationLng,
        ),
        config,
      );

      const evaluation = evaluateQueueEligibility({
        currentRide: {
          status: candidate.currentRideStatus,
          destinationLat: candidate.currentRideDestinationLat,
          destinationLng: candidate.currentRideDestinationLng,
        },
        newRideRequest: {
          id: ride.id,
          originLat: ride.originLat ?? 0,
          originLng: ride.originLng ?? 0,
          vehicleCategory: ride.requestedVehicleCategory ?? null,
        },
        driverStatus: {
          availability: "busy",
          currentRideId: candidate.currentRideId,
          queuedRideId: null,
          currentLat: candidate.currentLat,
          currentLng: candidate.currentLng,
          locationUpdatedAtMs: candidate.locationUpdatedAt?.getTime() ?? null,
          vehicleCategory: candidate.vehicleCategory,
          capabilities: {
            xl: candidate.capabilityXl,
            extraLuggage: candidate.capabilityExtraLuggage,
            comfort: candidate.capabilityComfort,
            vehicleYear: candidate.vehicleYear,
          },
        },
        currentTripRemainingMin,
        nowMs: now.getTime(),
        config,
      });

      return { candidate, evaluation };
    })
    .filter((r) => r.evaluation.eligible)
    .sort((a, b) => (a.evaluation.score ?? Infinity) - (b.evaluation.score ?? Infinity));

  if (ranked.length === 0) {
    logDecision(options.logger, {
      rideId: rideRequestId,
      candidateDriverId: null,
      score: null,
      decision: "NO_ELIGIBLE_CANDIDATE",
      reason: null,
      offerId: null,
      attemptOrder: null,
    });
    return { decision: "NO_ELIGIBLE_CANDIDATE", offerId: null, candidateDriverId: null, attemptOrder: null };
  }

  // Sólo 1 candidato a la vez en V1: se intenta el mejor score; si pierde la
  // carrera de unicidad en BD, se prueba con el siguiente de la lista
  // ordenada — todo dentro de esta misma invocación (no se re-consulta BD).
  for (const { candidate, evaluation } of ranked) {
    // Revalidación final justo antes de crear la oferta — no confiar en el
    // resultado calculado unos milisegundos antes.
    const revalidated = await driverStatusRepo.findByDriverId(candidate.driverUserId);
    const rideStillRequested = await ridesRepo.findById(rideRequestId);
    const stillEligible =
      revalidated != null &&
      revalidated.currentRideId === candidate.currentRideId &&
      revalidated.queuedRideId == null &&
      revalidated.availability === "busy" &&
      rideStillRequested?.status === "requested";

    if (!stillEligible) {
      logDecision(options.logger, {
        rideId: rideRequestId,
        candidateDriverId: candidate.driverUserId,
        score: evaluation.score,
        decision: "SKIPPED",
        reason: "REVALIDATION_FAILED",
        offerId: null,
        attemptOrder: nextAttemptOrder,
      });
      continue;
    }

    let created: RideAssignmentOffer | null = null;
    try {
      created = await offersRepo.createOffer({
        rideRequestId,
        driverUserId: candidate.driverUserId,
        expiresAt: new Date(now.getTime() + 20 * 1000),
        attemptOrder: nextAttemptOrder,
      });
    } catch (err) {
      const pgCode = (err as { code?: string; cause?: { code?: string } })?.code
        ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (pgCode === UNIQUE_VIOLATION_PG_CODE) {
        // Perdimos la carrera (otro productor concurrente ya creó una
        // oferta pending para este ride o para este conductor). Probar con
        // el siguiente candidato de la lista ya ordenada.
        logDecision(options.logger, {
          rideId: rideRequestId,
          candidateDriverId: candidate.driverUserId,
          score: evaluation.score,
          decision: "LOST_RACE",
          reason: "UNIQUE_VIOLATION",
          offerId: null,
          attemptOrder: nextAttemptOrder,
        });
        continue;
      }
      throw err;
    }

    logDecision(options.logger, {
      rideId: rideRequestId,
      candidateDriverId: candidate.driverUserId,
      score: evaluation.score,
      decision: "OFFER_CREATED",
      reason: null,
      offerId: created.id,
      attemptOrder: created.attemptOrder,
    });

    return {
      decision: "OFFER_CREATED",
      offerId: created.id,
      candidateDriverId: candidate.driverUserId,
      attemptOrder: created.attemptOrder,
    };
  }

  logDecision(options.logger, {
    rideId: rideRequestId,
    candidateDriverId: null,
    score: null,
    decision: "LOST_RACE_RETRY_EXHAUSTED",
    reason: null,
    offerId: null,
    attemptOrder: null,
  });
  return { decision: "LOST_RACE_RETRY_EXHAUSTED", offerId: null, candidateDriverId: null, attemptOrder: null };
}
