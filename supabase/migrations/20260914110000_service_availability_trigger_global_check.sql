-- Layer the Admin global service_availability switch onto the existing
-- inquiry_items trigger, ANDed with the per-partner check already there.
-- The global check runs BEFORE the "no partner assigned" early-return, so a
-- globally-disabled service blocks creation even for partner-less items
-- (e.g. a Follow-up with no partner selected).

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_partner_service_availability()
RETURNS TRIGGER AS $$
DECLARE
    v_inquiry RECORD;
    v_type TEXT;
    v_subtype TEXT;
BEGIN
    SELECT partner_id, type::text AS type INTO v_inquiry FROM public.inquiries WHERE id = NEW.inquiry_id;

    v_type := v_inquiry.type;
    v_subtype := CASE
        WHEN v_type IN ('Validation', 'Refill') THEN COALESCE(NEW.validation_mode, 'new')
        ELSE 'default'
    END;

    -- Admin global switch — applies regardless of whether a partner is assigned.
    IF EXISTS (
        SELECT 1 FROM public.service_availability
        WHERE service_type = v_type
          AND service_subtype = v_subtype
          AND is_enabled = false
    ) THEN
        RAISE EXCEPTION '% % service is currently unavailable.', v_type, v_subtype;
    END IF;

    -- No partner assigned yet (e.g. a follow-up item with no partner) — nothing more to enforce.
    IF v_inquiry.partner_id IS NULL THEN
        RETURN NEW;
    END IF;

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
