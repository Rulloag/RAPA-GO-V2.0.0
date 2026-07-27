SELECT current_database() AS database_name, current_user AS database_user,
       inet_server_addr()::text AS server_address, current_schema() AS current_schema;

WITH required(column_name) AS (
  VALUES ('estimated_fare_clp'),('origin_lat'),('origin_lng'),('destination_lat'),('destination_lng'),
    ('distance_meters'),('duration_seconds'),('fare_calculation_source'),
    ('payment_method'),('payment_provider'),('wallet_benefit_requested'),
    ('wallet_benefit_applied_clp'),('wallet_benefit_reversed_clp'),
    ('wallet_benefit_reversed_at'),('fare_before_wallet_benefit_clp'),
    ('driver_user_id'),('accepted_at'),('en_route_at'),('arrived_at'),
    ('started_at'),('completed_at'),('cancellation_reason'),
    ('cancelled_by_user_id'),('cancelled_by_role'),('is_offline_booking'),
    ('offline_passenger_name'),('offline_passenger_phone'),
    ('offline_passenger_email'),('ride_type'),('scheduled_pickup_at'),
    ('priority_fee_clp'),('flight_number'),('current_stop_order'),
    ('queued_offer_driver_id'),('assignment_mode'),('preferred_driver_gender')
)
SELECT required.column_name,
       CASE WHEN columns.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status,
       columns.data_type, columns.is_nullable, columns.column_default
FROM required
LEFT JOIN information_schema.columns columns
  ON columns.table_schema='public' AND columns.table_name='ride_requests'
 AND columns.column_name=required.column_name
ORDER BY required.column_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='account_deletion_requests'
  AND column_name IN ('reason','verified_at','apple_revocation_status',
    'apple_revocation_attempted_at','apple_revoked_at','apple_revocation_error')
ORDER BY column_name;
