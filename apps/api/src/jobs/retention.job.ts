import type { FastifyBaseLogger } from "fastify";
import { sql } from "drizzle-orm";

import { db } from "../db/client.js";
import { RideTrackingRepository } from "../modules/rideTracking/rideTracking.repository.js";

const DEFAULT_INTERVAL_MINUTES = 60;
const MINIMUM_INTERVAL_MINUTES = 15;

function isEnabled(): boolean {
  const configured = String(
    process.env["RETENTION_PURGE_ENABLED"] ?? "",
  )
    .trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  return process.env["NODE_ENV"] === "production";
}

function intervalMilliseconds(): number {
  const configured = Number(
    process.env["RETENTION_PURGE_INTERVAL_MINUTES"] ??
      DEFAULT_INTERVAL_MINUTES,
  );

  const minutes =
    Number.isFinite(configured) &&
    configured >= MINIMUM_INTERVAL_MINUTES
      ? configured
      : DEFAULT_INTERVAL_MINUTES;

  return minutes * 60 * 1000;
}

export class RetentionJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly rideTrackingRepository =
      new RideTrackingRepository(),
  ) {}

  start(): void {
    if (!isEnabled() || this.timer) {
      if (!isEnabled()) {
        this.logger.info(
          "Retention purge job is disabled for this environment.",
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
      {
        intervalMinutes:
          intervalMilliseconds() / (60 * 1000),
      },
      "Retention purge job started.",
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const nowIso = now.toISOString();
      const purgedRideLocations =
        await this.rideTrackingRepository.purgeExpired(now);

      // Los códigos no contienen el correo en claro. Se conserva un máximo
      // de 30 días después de vencer/consumirse para investigar abuso.
      await db.execute(sql`
        DELETE FROM public.account_deletion_verifications
        WHERE expires_at <
          (${nowIso}::timestamptz - interval '30 days')
      `);

      // Los intercambios de Facebook son credenciales efímeras.
      await db.execute(sql`
        DELETE FROM public.facebook_login_exchanges
        WHERE expires_at <
          (${nowIso}::timestamptz - interval '7 days')
      `);

      // Después de 30 días se elimina el número bancario cifrado y
      // el adjunto de transferencia; se conservan referencia, monto y last4.
      await db.execute(sql`
        UPDATE public.cash_overpayment_refund_requests
        SET
          bank_account_number_encrypted = NULL,
          transfer_proof_url = NULL,
          sensitive_data_purged_at = ${nowIso}::timestamptz,
          updated_at = ${nowIso}::timestamptz
        WHERE completed_at IS NOT NULL
          AND completed_at <
            (${nowIso}::timestamptz - interval '30 days')
          AND sensitive_data_purged_at IS NULL
      `);

      this.logger.info(
        { purgedRideLocations },
        "Retention purge completed.",
      );
    } catch (error) {
      this.logger.error(
        { error },
        "Retention purge failed; it will be retried.",
      );
    } finally {
      this.running = false;
    }
  }
}
