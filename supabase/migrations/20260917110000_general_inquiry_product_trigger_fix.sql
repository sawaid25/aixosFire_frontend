-- A General Inquiry (see 20260917100000_general_inquiry_routing_columns.sql) has
-- partner_id = NULL by design, but its inquiry_items should still be able to carry
-- product_id for traceability (which product the Agent originally asked about).
-- The existing enforce_inquiry_item_product_assignment() trigger (from
-- 20260822120000_products_catalog.sql) currently RAISEs whenever product_id is set
-- but the inquiry has no partner — loosen that one branch to a no-op instead, since
-- there is no partner to validate the assignment against. Nothing in the current
-- flow ever set product_id without a partner already selected, so this only adds a
-- new allowed case and changes no existing behavior.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_inquiry_item_product_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_id UUID;
BEGIN
    IF NEW.product_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT partner_id INTO v_partner_id FROM public.inquiries WHERE id = NEW.inquiry_id;

    -- No partner to check the assignment against (e.g. a General Inquiry) — the
    -- product_id is kept purely for traceability, nothing to enforce here.
    IF v_partner_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.partner_products
        WHERE partner_id = v_partner_id AND product_id = NEW.product_id
    ) THEN
        RAISE EXCEPTION 'product % is not assigned to partner % — rejecting inquiry item', NEW.product_id, v_partner_id;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
