-- General Inquiry routing: an inquiry created by an Agent when NO Partner is eligible
-- for the selected product/service combination. Additive only — two boolean flags,
-- no new tables, no touching the existing inquiry_type enum.
--
-- inquiries.is_general_inquiry — set true only when the Agent explicitly chose
--   "General Inquiry" at creation (partner_id is NULL in that case). This is a
--   distinct, permanent provenance marker — it stays true even after an Admin later
--   assigns a Partner to it, so Admin can always tell it originated as unrouted.
--   It is NOT set for the other pre-existing cases where partner_id can be NULL
--   (e.g. a follow-up-only Validation/Refill item), so those keep behaving exactly
--   as before.
-- admins.receives_general_inquiries — which Admin account(s) should be notified
--   when a General Inquiry is created. Admin-configurable (see
--   PUT /api/admin/general-inquiry-admins), never hardcoded. Defaults to false on
--   every existing row; the notification-sending code falls back to notifying every
--   Admin when none are explicitly opted in, so nothing is silently dropped.

BEGIN;

ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS is_general_inquiry BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_inquiries_general_inquiry
    ON public.inquiries (is_general_inquiry)
    WHERE is_general_inquiry;

ALTER TABLE public.admins
    ADD COLUMN IF NOT EXISTS receives_general_inquiries BOOLEAN NOT NULL DEFAULT false;

COMMIT;
