-- Migration 0031: queued ride offers
-- Adds support for sending a ride proposal to a busy driver
-- while they are completing their current trip.

-- ── 1. Extend ride_requests ───────────────────────────────────────────────────
ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS queued_offer_driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_mode VARCHAR(20) NOT NULL DEFAULT 'automatic';

-- ── 2. Extend driver_statuses ─────────────────────────────────────────────────
ALTER TABLE driver_statuses
  ADD COLUMN IF NOT EXISTS queued_ride_id UUID REFERENCES ride_requests(id) ON DELETE SET NULL;

-- ── 3. Create ride_assignment_offers ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ride_assignment_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id  UUID NOT NULL REFERENCES ride_requests(id)  ON DELETE CASCADE,
  driver_user_id   UUID NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  offered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  responded_at     TIMESTAMPTZ,
  response_source  VARCHAR(20),
  attempt_order    INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Constraints ────────────────────────────────────────────────────────────
ALTER TABLE ride_assignment_offers
  ADD CONSTRAINT chk_offer_status
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  ADD CONSTRAINT chk_offer_attempt_order
    CHECK (attempt_order >= 1),
  ADD CONSTRAINT chk_offer_expires_after_offered
    CHECK (expires_at > offered_at);

-- ── 5. Standard indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ride_assignment_offers_ride
  ON ride_assignment_offers (ride_request_id);

CREATE INDEX IF NOT EXISTS idx_ride_assignment_offers_driver
  ON ride_assignment_offers (driver_user_id);

CREATE INDEX IF NOT EXISTS idx_ride_assignment_offers_expires
  ON ride_assignment_offers (expires_at)
  WHERE status = 'pending';

-- ── 6. Partial unique indexes — enforce one pending offer per ride/driver ─────
CREATE UNIQUE INDEX IF NOT EXISTS uq_ride_offer_pending
  ON ride_assignment_offers (ride_request_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_offer_pending
  ON ride_assignment_offers (driver_user_id)
  WHERE status = 'pending';
