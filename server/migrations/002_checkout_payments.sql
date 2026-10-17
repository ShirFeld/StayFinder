CREATE TABLE checkouts (
 id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 property_id INTEGER NOT NULL REFERENCES properties(id),
 request_key TEXT NOT NULL,
 check_in TEXT NOT NULL,
 check_out TEXT NOT NULL CHECK(check_out > check_in),
 guests INTEGER NOT NULL CHECK(guests > 0),
 nights INTEGER NOT NULL CHECK(nights > 0),
 nightly_price_cents INTEGER NOT NULL CHECK(nightly_price_cents > 0),
 total_cents INTEGER NOT NULL CHECK(total_cents = nights * nightly_price_cents),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
 property_name TEXT NOT NULL,
 customer_email TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','open','completed','expired','cancelled','failed','refund_pending','refunded')),
 expires_at INTEGER NOT NULL,
 stripe_expires_at INTEGER NOT NULL,
 stripe_session_id TEXT UNIQUE,
 checkout_url TEXT,
 payment_intent_id TEXT UNIQUE,
 refund_id TEXT UNIQUE,
 refund_attempt INTEGER NOT NULL DEFAULT 0,
 cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
 last_error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id, request_key)
);
CREATE INDEX checkout_availability ON checkouts(property_id,status,expires_at,check_in,check_out);
ALTER TABLE bookings ADD COLUMN checkout_id TEXT REFERENCES checkouts(id);
ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'legacy' CHECK(payment_status IN ('legacy','paid','refund_pending','refunded','refund_failed'));
ALTER TABLE bookings ADD COLUMN refund_id TEXT;
CREATE UNIQUE INDEX booking_checkout ON bookings(checkout_id) WHERE checkout_id IS NOT NULL;

-- Active holds and confirmed bookings both occupy a unit. Expired holds do not.
CREATE TRIGGER checkout_no_overlap_insert BEFORE INSERT ON checkouts
WHEN NEW.status IN ('creating','open') AND NEW.expires_at > unixepoch()
AND (
 EXISTS(SELECT 1 FROM bookings b WHERE b.property_id=NEW.property_id AND b.status='confirmed' AND b.check_in<NEW.check_out AND b.check_out>NEW.check_in)
 OR EXISTS(SELECT 1 FROM checkouts c WHERE c.property_id=NEW.property_id AND c.status IN ('creating','open') AND c.expires_at>unixepoch() AND c.check_in<NEW.check_out AND c.check_out>NEW.check_in)
) BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT'); END;
CREATE TRIGGER checkout_no_overlap_update BEFORE UPDATE OF status,expires_at,check_in,check_out,property_id ON checkouts
WHEN NEW.status IN ('creating','open') AND NEW.expires_at > unixepoch()
AND (
 EXISTS(SELECT 1 FROM bookings b WHERE b.property_id=NEW.property_id AND b.status='confirmed' AND b.checkout_id IS NOT NEW.id AND b.check_in<NEW.check_out AND b.check_out>NEW.check_in)
 OR EXISTS(SELECT 1 FROM checkouts c WHERE c.id<>NEW.id AND c.property_id=NEW.property_id AND c.status IN ('creating','open') AND c.expires_at>unixepoch() AND c.check_in<NEW.check_out AND c.check_out>NEW.check_in)
) BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT'); END;
CREATE TRIGGER booking_respects_holds_insert BEFORE INSERT ON bookings
WHEN NEW.status='confirmed' AND EXISTS(
 SELECT 1 FROM checkouts c WHERE c.property_id=NEW.property_id AND c.id IS NOT NEW.checkout_id
 AND c.status IN ('creating','open') AND c.expires_at>unixepoch() AND c.check_in<NEW.check_out AND c.check_out>NEW.check_in
) BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT'); END;
CREATE TRIGGER booking_respects_holds_update BEFORE UPDATE ON bookings
WHEN NEW.status='confirmed' AND EXISTS(
 SELECT 1 FROM checkouts c WHERE c.property_id=NEW.property_id AND c.id IS NOT NEW.checkout_id
 AND c.status IN ('creating','open') AND c.expires_at>unixepoch() AND c.check_in<NEW.check_out AND c.check_out>NEW.check_in
) BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT'); END;
