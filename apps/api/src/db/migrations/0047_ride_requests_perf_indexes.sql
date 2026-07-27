-- Fase 1 del plan de optimización de rendimiento (indexing).
-- IDX-01..IDX-04: ride_requests no tenía ningún índice más allá de la PK,
-- pese a ser la tabla más consultada del sistema (feed de conductores,
-- historial de pasajero/conductor, agregaciones del dashboard admin).
--
-- CREATE INDEX CONCURRENTLY no es compatible con el runner de migraciones
-- (drizzle-orm envuelve todas las migraciones pendientes en una única
-- transacción vía session.transaction, y Postgres prohíbe CONCURRENTLY
-- dentro de un bloque de transacción). Por eso estos índices usan
-- CREATE INDEX estándar. Para aplicar esta migración contra producción
-- con la tabla ya poblada y sin aceptar un lock breve de escritura,
-- ejecutar las mismas cuatro sentencias manualmente con CONCURRENTLY
-- fuera de este runner, y luego marcar la migración como aplicada.

CREATE INDEX IF NOT EXISTS "ride_requests_status_requested_at_idx"
  ON "ride_requests" USING btree ("status", "requested_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ride_requests_passenger_requested_at_idx"
  ON "ride_requests" USING btree ("passenger_user_id", "requested_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ride_requests_driver_accepted_at_idx"
  ON "ride_requests" USING btree ("driver_user_id", "accepted_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ride_requests_requested_at_idx"
  ON "ride_requests" USING btree ("requested_at");
