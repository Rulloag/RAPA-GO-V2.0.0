-- PARTE 28A: Add gender to driver_profiles and preferredDriverGender to ride_requests.
-- Gender is stored on the driver profile (not users) for privacy separation.
-- preferredDriverGender is passenger-supplied at ride creation; only "female" is a valid preference.

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS preferred_driver_gender VARCHAR(10);
