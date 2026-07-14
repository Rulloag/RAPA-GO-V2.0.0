CREATE TABLE IF NOT EXISTS rental_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES users(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  plate TEXT NOT NULL UNIQUE,
  color TEXT,
  type TEXT NOT NULL,
  seats INTEGER,
  transmission TEXT,
  fuel_type TEXT,
  daily_price INTEGER NOT NULL,
  description TEXT,
  features TEXT[],
  photos TEXT[],
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rental_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES rental_vehicles(id),
  passenger_id UUID NOT NULL REFERENCES users(id),
  operator_id UUID NOT NULL REFERENCES users(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  pickup_time TEXT,
  return_time TEXT,
  pickup_location TEXT,
  return_location TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_price INTEGER,
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_vehicles_operator ON rental_vehicles(operator_id);
CREATE INDEX IF NOT EXISTS idx_rental_vehicles_status ON rental_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_passenger ON rental_bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_operator ON rental_bookings(operator_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_vehicle ON rental_bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_status ON rental_bookings(status);
