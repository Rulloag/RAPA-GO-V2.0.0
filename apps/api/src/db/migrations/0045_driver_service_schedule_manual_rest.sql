ALTER TABLE "driver_rest_schedules"
ADD COLUMN IF NOT EXISTS "service_start_minute_local" integer NOT NULL DEFAULT 600;
--> statement-breakpoint

ALTER TABLE "driver_rest_periods"
ADD COLUMN IF NOT EXISTS "decision" varchar(30);
--> statement-breakpoint

ALTER TABLE "driver_rest_periods"
ADD COLUMN IF NOT EXISTS "decision_at" timestamp with time zone;
--> statement-breakpoint

-- Las versiones anteriores podían dejar un período pendiente y bloquear al
-- conductor solo por alcanzar la hora programada. Desde esta versión la hora
-- es únicamente un aviso y el descanso se inicia por decisión manual.
UPDATE "driver_rest_periods"
SET
  "status" = 'reminder_due',
  "decision" = NULL,
  "decision_at" = NULL,
  "updated_at" = NOW()
WHERE
  "actual_start_at" IS NULL
  AND "status" IN ('scheduled', 'pending_trip_completion');
