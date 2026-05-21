CREATE TABLE IF NOT EXISTS tourist_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  duration_minutes INTEGER,
  max_people INTEGER,
  price INTEGER,
  includes TEXT[],
  languages TEXT[],
  meeting_point TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES tourist_services(id),
  passenger_id UUID NOT NULL REFERENCES users(id),
  guide_id UUID NOT NULL REFERENCES users(id),
  booking_date TEXT NOT NULL,
  booking_time TEXT,
  number_of_people INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  total_price INTEGER,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tourist_services_guide ON tourist_services(guide_id);
CREATE INDEX IF NOT EXISTS idx_tourist_services_status ON tourist_services(status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_passenger ON service_bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_guide ON service_bookings(guide_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON service_bookings(status);
