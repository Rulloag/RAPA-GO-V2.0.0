import "dotenv/config";
import postgres from "postgres";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL no está configurada.");
const parsed = new URL(databaseUrl);
const db = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15 });
const required = ["estimated_fare_clp","origin_lat","origin_lng","destination_lat","destination_lng","distance_meters","duration_seconds","fare_calculation_source","payment_method","payment_provider","wallet_benefit_requested","wallet_benefit_applied_clp","wallet_benefit_reversed_clp","wallet_benefit_reversed_at","fare_before_wallet_benefit_clp","driver_user_id","accepted_at","en_route_at","arrived_at","started_at","completed_at","cancellation_reason","cancelled_by_user_id","cancelled_by_role","is_offline_booking","offline_passenger_name","offline_passenger_phone","offline_passenger_email","ride_type","scheduled_pickup_at","priority_fee_clp","flight_number","current_stop_order","queued_offer_driver_id","assignment_mode","preferred_driver_gender"];
try {
  console.log("CONEXIÓN SEGURA", { configuredHost: parsed.hostname, configuredDatabase: parsed.pathname.replace(/^\//, ""), configuredUser: decodeURIComponent(parsed.username) });
  const identity = await db`SELECT current_database() AS database_name, current_user AS database_user, inet_server_addr()::text AS server_address, current_schema() AS current_schema`;
  console.table(identity);
  const rows = await db`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ride_requests'`;
  const existing = new Set(rows.map((row) => row.column_name));
  const missing = required.filter((name) => !existing.has(name));
  console.log("\nCOLUMNAS FALTANTES EN ride_requests");
  console.table(missing.map((column_name) => ({ column_name })));
  const deletion = await db`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='account_deletion_requests' AND column_name IN ('reason','verified_at','apple_revocation_status','apple_revocation_attempted_at','apple_revoked_at','apple_revocation_error') ORDER BY column_name`;
  console.log("\nCOLUMNAS DE ELIMINACIÓN DE CUENTA");
  console.table(deletion);
  if (missing.length > 0) {
    process.exitCode = 2;
    console.error("\nESQUEMA INCOMPLETO: aplica la migración 0043 en la misma base usada por Hostinger.");
  } else {
    console.log("\nESQUEMA RUNTIME: OK");
  }
} finally { await db.end(); }
