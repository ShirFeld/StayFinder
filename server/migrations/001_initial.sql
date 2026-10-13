CREATE TABLE users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','customer')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE properties (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, destination TEXT NOT NULL, description TEXT NOT NULL,
 price_cents INTEGER NOT NULL CHECK(price_cents > 0), capacity INTEGER NOT NULL CHECK(capacity > 0),
 amenities TEXT NOT NULL, images TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE bookings (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 property_id INTEGER NOT NULL REFERENCES properties(id), check_in TEXT NOT NULL, check_out TEXT NOT NULL,
 guests INTEGER NOT NULL CHECK(guests > 0), nights INTEGER NOT NULL CHECK(nights > 0),
 nightly_price_cents INTEGER NOT NULL CHECK(nightly_price_cents > 0),
 total_cents INTEGER NOT NULL CHECK(total_cents > 0), currency TEXT NOT NULL DEFAULT 'USD',
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at TEXT,
 CHECK(check_out > check_in), CHECK(total_cents = nights * nightly_price_cents)
);
CREATE INDEX booking_availability ON bookings(property_id,status,check_in,check_out);
CREATE INDEX booking_owner ON bookings(user_id);
CREATE TRIGGER booking_no_overlap BEFORE INSERT ON bookings
WHEN NEW.status = 'confirmed' AND EXISTS(
 SELECT 1 FROM bookings WHERE property_id = NEW.property_id AND status = 'confirmed'
 AND check_in < NEW.check_out AND check_out > NEW.check_in
) BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT'); END;
CREATE TRIGGER booking_no_overlap_update BEFORE UPDATE ON bookings
WHEN NEW.status = 'confirmed' AND EXISTS(
 SELECT 1 FROM bookings WHERE id <> NEW.id AND property_id = NEW.property_id AND status = 'confirmed'
 AND check_in < NEW.check_out AND check_out > NEW.check_in
) BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT'); END;
CREATE TABLE sessions(sid TEXT PRIMARY KEY, expires INTEGER NOT NULL, data TEXT NOT NULL);
