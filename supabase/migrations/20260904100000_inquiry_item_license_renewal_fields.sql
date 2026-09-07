-- License Renewal sub-mode for Validation & Refill inquiry items (Agent Visit Form).
--
-- Adds the fields that have no existing home. License Expiry Date reuses the
-- existing `expiry_date` column, and the Follow-up date reuses the existing
-- `follow_up_date_validation` column (now shared by both Validation and Refill
-- follow-up items, not just Validation) — no new columns needed for either.

BEGIN;

ALTER TABLE public.inquiry_items
    ADD COLUMN IF NOT EXISTS license_number TEXT;

ALTER TABLE public.inquiry_items
    ADD COLUMN IF NOT EXISTS license_authority TEXT;

ALTER TABLE public.inquiry_items
    ADD COLUMN IF NOT EXISTS license_renewal_date DATE;

ALTER TABLE public.inquiry_items
    ADD COLUMN IF NOT EXISTS license_notes TEXT;

ALTER TABLE public.inquiry_items
    ADD COLUMN IF NOT EXISTS license_document_url TEXT;

COMMIT;
