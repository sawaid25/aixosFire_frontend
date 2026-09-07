-- Harden the inquiry_item ↔ partner_products enforcement for the Agent
-- inquiry-creation flow (New Unit / Maintenance / Refill / Validation product
-- pickers on the Visit Form).
--
-- Existing behaviour (from 20260822120000_products_catalog.sql):
--   • an inquiry_item's product_id must belong to a product assigned to that
--     inquiry's partner (partner_products) — enforced on INSERT and on
--     UPDATE OF product_id.
--
-- Added here:
--   • on INSERT only, the product must ALSO be active (products.is_active).
--     This backs the front-end picker, which already lists only active
--     assigned products, so a tampered client payload can't attach a
--     deactivated product to a brand-new inquiry item.
--
-- Deliberately NOT applied to UPDATE: historical / existing inquiry items must
-- keep working even after a product is later deactivated or unassigned. The
-- trigger only fires on INSERT or on an explicit UPDATE OF product_id, so
-- normal status / note / follow-up edits and plain reads are never affected,
-- and no historical data is touched.

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

    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'inquiry_items.product_id is set but inquiry % has no partner_id', NEW.inquiry_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.partner_products
        WHERE partner_id = v_partner_id AND product_id = NEW.product_id
    ) THEN
        RAISE EXCEPTION 'product % is not assigned to partner % — rejecting inquiry item', NEW.product_id, v_partner_id;
    END IF;

    -- New inquiry items may only reference an active product. Existing items
    -- (UPDATE) are left alone so deactivation never breaks history.
    IF TG_OP = 'INSERT' AND NOT EXISTS (
        SELECT 1 FROM public.products WHERE id = NEW.product_id AND is_active
    ) THEN
        RAISE EXCEPTION 'product % is inactive and cannot be used for a new inquiry item', NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger definition itself is unchanged (still BEFORE INSERT OR UPDATE OF
-- product_id) — CREATE OR REPLACE FUNCTION swaps the body in place.

COMMIT;
