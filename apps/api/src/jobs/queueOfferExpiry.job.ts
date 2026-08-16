import type { FastifyBaseLogger } from "fastify";

import { RideAssignmentOffersRepository } from "../modules/rides/rideAssignmentOffers.repository.js";
import { attemptQueuedOffer } from "../modules/rides/rideQueueOfferProducer.service.js";

const DEFAULT_SWEEP_MS = 7000;
const MINIMUM_SWEEP_MS = 3000;

function isEnabled(): boolean {
  const configured = process.env["QUEUE_OFFER_EXPIRY_ENABLED"]
    ?.trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  return process.env["NODE_ENV"] === "production";
}

function intervalMilliseconds(): number {
  const configured = Number(
    process.env["QUEUE_OFFER_EXPIRY_SWEEP_MS"] ?? DEFAULT_SWEEP_MS,
  );

  return Number.isFinite(configured) && configured >= MINIMUM_SWEEP_MS
    ? configured
    : DEFAULT_SWEEP_MS;
}

/**
 * Avance autónomo de la preasignación encadenada (Fase 2.1).
 *
 * TTL de una oferta = 20s. Sin este job, una oferta vencida sólo se
 * detecta/avanza la próxima vez que algo dispare attemptQueuedOffer()
 * (nuevo ride, rechazo) — lo que podía dejar el ride B "congelado" sin
 * ningún candidato pendiente si no ocurría ningún otro evento.
 *
 * Cada barrido:
 *   1. expira (BD) todas las ofertas pending vencidas y obtiene los
 *      rideRequestId afectados;
 *   2. por cada ride afectado (deduplicado), llama attemptQueuedOffer(),
 *      que ya internamente valida que el ride siga 'requested', evita
 *      duplicar si ya hay una oferta pending, y trata 23505 como carrera
 *      perdida frente a un rejectOffer/aceptación/otro sweep concurrente.
 *
 * No agrega ninguna garantía de concurrencia nueva: reutiliza los mismos
 * índices únicos parciales y la misma revalidación que ya protegen a
 * attemptQueuedOffer() cuando se dispara por evento.
 */
export class QueueOfferExpiryJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly offersRepo = new RideAssignmentOffersRepository(),
  ) {}

  start(): void {
    if (!isEnabled() || this.timer) {
      if (!isEnabled()) {
        this.logger.info(
          "Queue offer expiry sweep job is disabled for this environment.",
        );
      }
      return;
    }

    void this.run();

    const timer = setInterval(() => {
      void this.run();
    }, intervalMilliseconds());

    timer.unref();
    this.timer = timer;

    this.logger.info(
      { intervalMs: intervalMilliseconds() },
      "Queue offer expiry sweep job started.",
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const expiredRideIds = await this.offersRepo.expireStaleReturningRideIds(now);
      const uniqueRideIds = [...new Set(expiredRideIds)];

      let processed = 0;
      for (const rideId of uniqueRideIds) {
        try {
          await attemptQueuedOffer(rideId, { now, logger: this.logger });
          processed += 1;
        } catch (error) {
          // Un ride con error no debe impedir procesar los siguientes.
          this.logger.error(
            { error, rideId },
            "Queue offer expiry sweep failed for one ride; continuing with the rest.",
          );
        }
      }

      if (uniqueRideIds.length > 0) {
        this.logger.info(
          { expiredOffers: expiredRideIds.length, ridesProcessed: processed },
          "Queue offer expiry sweep completed.",
        );
      }
    } catch (error) {
      this.logger.error(
        { error },
        "Queue offer expiry sweep failed; it will be retried.",
      );
    } finally {
      this.running = false;
    }
  }
}
