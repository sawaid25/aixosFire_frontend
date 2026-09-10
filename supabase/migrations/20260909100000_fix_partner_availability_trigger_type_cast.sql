-- Fix: inquiries.type turns out to be a custom Postgres enum (inquiry_type),
-- not plain text — the previous trigger compared it directly against text
-- literals/columns ('Validation', 'Refill', partner_service_availability.
-- service_type), which Postgres rejects with "operator does not exist: text
-- = inquiry_type". Casting to ::text fixes it regardless of the column's
-- real underlying type (a no-op cast if it ever were plain text).

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_partner_service_availability()
RETURNS TRIGGER AS $$
DECLARE
    v_inquiry RECORD;
    v_type TEXT;
    v_subtype TEXT;
BEGIN
    SELECT partner_id, type::text AS type INTO v_inquiry FROM public.inquiries WHERE id = NEW.inquiry_id;

    -- No partner assigned yet (e.g. a follow-up item with no partner) — nothing to enforce.
    IF v_inquiry.partner_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_type := v_inquiry.type;

    v_subtype := CASE
        WHEN v_type IN ('Validation', 'Refill') THEN COALESCE(NEW.validation_mode, 'new')
        ELSE 'default'
    END;

    IF EXISTS (
        SELECT 1 FROM public.partner_service_availability
        WHERE partner_id = v_inquiry.partner_id
          AND service_type = v_type
          AND service_subtype = v_subtype
          AND is_enabled = false
    ) THEN
        RAISE EXCEPTION 'This Partner does not currently offer % % services.', v_type, v_subtype;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
