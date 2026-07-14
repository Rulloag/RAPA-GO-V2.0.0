ALTER TABLE tourist_services
  ADD COLUMN IF NOT EXISTS includes_vehicle BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conditions TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;

CREATE TABLE IF NOT EXISTS service_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES tourist_services(id),
  min_people INTEGER NOT NULL,
  max_people INTEGER NOT NULL,
  price INTEGER NOT NULL,
  UNIQUE(service_id, min_people)
);

CREATE INDEX IF NOT EXISTS idx_service_pricing_tiers_service ON service_pricing_tiers(service_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
