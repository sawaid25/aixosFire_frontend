-- Rejection reason for the Partner-side Renewal flow (and, incidentally, any
-- other inquiry type that starts capturing one in future — no inquiry type
-- has ever recorded a reason today, this is additive-only).

BEGIN;

ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMIT;
