-- Open server/data/stayfinder.sqlite with a SQLite client. Read-only practice queries.
SELECT id, name, email, role, active FROM users ORDER BY id;
SELECT destination, COUNT(*) AS units, MIN(price_cents) AS cheapest_cents
FROM properties WHERE active = 1 GROUP BY destination;
SELECT b.id, u.email, p.name, b.check_in, b.check_out, b.status,
       b.nightly_price_cents, b.nights, b.total_cents
FROM bookings b JOIN users u ON u.id = b.user_id
JOIN properties p ON p.id = b.property_id ORDER BY b.id;
-- Expected zero rows: incorrect snapshots.
SELECT * FROM bookings WHERE total_cents <> nights * nightly_price_cents;
-- Expected zero rows: overlapping active reservations.
SELECT a.id, b.id FROM bookings a JOIN bookings b
ON a.property_id = b.property_id AND a.id < b.id
AND a.check_in < b.check_out AND a.check_out > b.check_in
WHERE a.status = 'confirmed' AND b.status = 'confirmed';
-- Replace example dates and guest count with values valid for your business date.
SELECT p.id, p.name FROM properties p WHERE p.active = 1 AND p.capacity >= 2
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.property_id = p.id
AND b.status = 'confirmed' AND b.check_in < '2030-06-13' AND b.check_out > '2030-06-10');
