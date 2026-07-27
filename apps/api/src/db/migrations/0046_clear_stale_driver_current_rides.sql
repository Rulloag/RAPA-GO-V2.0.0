-- Corrige viajes fantasma que impiden marcar al conductor como Disponible.
-- ride_requests es la fuente de verdad del viaje activo.

UPDATE "driver_statuses" AS ds
SET
  "current_ride_id" = NULL,
  "availability" = CASE
    WHEN ds."availability" = 'busy' THEN 'unavailable'
    ELSE ds."availability"
  END,
  "updated_at" = NOW()
WHERE ds."current_ride_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ride_requests" AS rr
    WHERE rr."id" = ds."current_ride_id"
      AND rr."driver_user_id" = ds."driver_user_id"
      AND rr."status" IN (
        'accepted',
        'driver_en_route',
        'driver_arrived',
        'in_progress'
      )
  );
