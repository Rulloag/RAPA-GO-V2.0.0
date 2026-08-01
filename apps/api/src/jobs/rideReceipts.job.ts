import type { FastifyBaseLogger } from "fastify";

import { rideReceiptsService } from "../modules/rideReceipts/rideReceipts.service.js";

const DEFAULT_INTERVAL_MINUTES = 5;
const MINIMUM_INTERVAL_MINUTES = 2;

function isEnabled(): boolean {
  const configured = process.env["RIDE_RECEIPTS_ENABLED"]
    ?.trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  return process.env["NODE_ENV"] === "production";
}

function intervalMilliseconds(): number {
  const configured = Number(
    process.env["RIDE_RECEIPTS_RETRY_INTERVAL_MINUTES"] ??
      DEFAULT_INTERVAL_MINUTES,
  );

  const minutes =
    Number.isFinite(configured) &&
    configured >= MINIMUM_INTERVAL_MINUTES
      ? configured
      : DEFAULT_INTERVAL_MINUTES;

  return minutes * 60 * 1000;
}

export class RideReceiptsJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly logger: FastifyBaseLogger) {}

  start(): void {
    if (!isEnabled() || this.timer) {
      if (!isEnabled()) {
        this.logger.info(
          "Ride receipt generation job is disabled for this environment.",
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
      "Ride receipt generation job started.",
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const processed =
        await rideReceiptsService.processRetryable(10);

      if (processed > 0) {
        this.logger.info(
          { processed },
          "Ride receipt generation cycle completed.",
        );
      }
    } catch (error) {
      this.logger.error(
        { error },
        "Ride receipt generation cycle failed; it will be retried.",
      );
    } finally {
      this.running = false;
    }
  }
}
