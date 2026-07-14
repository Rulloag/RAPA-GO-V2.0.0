CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  external_event_id TEXT NOT NULL,
  external_booking_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date TEXT,
  event_location TEXT,
  ticket_code TEXT NOT NULL UNIQUE,
  qr_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payment_order_id UUID,
  validated_at TIMESTAMP,
  validated_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_tickets_user ON event_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_event_tickets_code ON event_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_event_tickets_status ON event_tickets(status);
