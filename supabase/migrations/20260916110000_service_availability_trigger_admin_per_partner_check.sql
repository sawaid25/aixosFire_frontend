-- Layer the new per-partner Admin override (admin_enabled) onto the existing trigger,
-- as a third AND condition alongside the global switch and the Partner's own preference.
-- Own EXISTS check + distinct message so the failure reason is clear (Admin-for-this-
-- partner vs. the Partner's own choice).

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

    -- Admin's per-partner override — independent of the Partner's own preference below.
    IF EXISTS (
        SELECT 1 FROM public.partner_service_availability
        WHERE partner_id = v_inquiry.partner_id
          AND service_type = v_type
          AND service_subtype = v_subtype
          AND admin_enabled = false
    ) THEN
        RAISE EXCEPTION 'This service has been disabled by Admin for this Partner (% %).', v_type, v_subtype;
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
