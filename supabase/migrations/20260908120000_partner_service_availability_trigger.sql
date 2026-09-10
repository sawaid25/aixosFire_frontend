-- Enforces partner_service_availability at the database level, so it can't be
-- bypassed by a tampered client — inquiry creation goes through direct-Supabase
-- calls (frontend/src/api/inquirySupabase.js), not the Express backend, so the
-- database itself is the only genuinely unbypassable enforcement point for
-- that path. This mirrors the existing pattern used for sticker-balance
-- enforcement (consume_partner_sticker_for_inquiry), not a new approach.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_partner_service_availability()
RETURNS TRIGGER AS $$
DECLARE
    v_inquiry RECORD;
    v_type TEXT;
    v_subtype TEXT;
BEGIN
    -- inquiries.type is a custom enum (inquiry_type), not plain text — cast it so the
    -- text comparisons below don't fail with "operator does not exist: text = inquiry_type".
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

DROP TRIGGER IF EXISTS trg_enforce_partner_service_availability ON public.inquiry_items;
CREATE TRIGGER trg_enforce_partner_service_availability
    BEFORE INSERT ON public.inquiry_items
    FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_service_availability();

COMMIT;
