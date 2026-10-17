ALTER TABLE checkouts ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'none'
 CHECK(refund_status IN ('none','pending','failed','succeeded'));
UPDATE checkouts SET refund_status=CASE
 WHEN status='refunded' THEN 'succeeded'
 WHEN status='refund_pending' AND last_error='Refund failed; retry cancellation' THEN 'failed'
 WHEN status='refund_pending' THEN 'pending' ELSE 'none' END;
