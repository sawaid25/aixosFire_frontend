-- Product Management: Category → Product master catalog + many-to-many
-- Partner assignment.
--
-- categories           — admin-managed top-level groupings (Fire Alarm System,
--                        Fire Pumps, Valves, ...). Deactivate via is_active,
--                        never delete — products keep referencing a real row.
-- products              — one row per real product/model (e.g. "FRN 3002 —
--                        Addressable Fire Alarm Control Panel"), belongs to
--                        exactly one category. model_number + specifications
--                        (free-form JSONB key/value pairs) hold the real
--                        catalogue data; nothing here is invented client-side.
-- partner_products      — many-to-many: a product can be assigned to many
--                        Partners, a Partner can have many products. UNIQUE
--                        prevents double-assign.
-- inquiry_items.product_id — nullable, additive. Existing rows get NULL and
--                        are unaffected. It's for traceability only — the
--                        existing free-text type/system/system_type columns
--                        already capture what was picked at creation time, so
--                        a later edit or deactivation of the product never
--                        changes how a past inquiry item renders.
--
-- Enforcement: the Agent visit-creation flow writes inquiry_items directly
-- from the browser with the anon key (src/api/inquirySupabase.js), bypassing
-- the Express backend entirely — so "Agent can't pick a product not assigned
-- to the selected Partner" can only be reliably enforced with a DB trigger,
-- not just a backend-layer check. See enforce_inquiry_item_product_assignment().

BEGIN;

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A prior run of this file (before it was reworked to a Category → Product
-- hierarchy) may already have created `products` with the old flat schema
-- (a plain `category TEXT` column, no `category_id`/`model_number`/
-- `specifications`). `CREATE TABLE IF NOT EXISTS` silently no-ops in that
-- case, so the new columns have to be added explicitly here rather than
-- assumed to exist from the CREATE TABLE above — this makes the migration
-- safe to run whether `products` is brand new or already exists in the old
-- shape.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model_number TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS specifications JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Clean up the 4 placeholder rows ("Fire Fighting System" etc.) inserted by
-- the old flat seed migration, if present — they were never real products,
-- just the 4 category names themselves. Matched narrowly (uncategorized +
-- exact legacy name) so it can never touch a real product an admin created.
DELETE FROM public.products
WHERE category_id IS NULL
  AND name IN ('Fire Fighting System', 'Fire Alarm System', 'Fire Pumps', 'Tanks')
  AND description IN (
    'Sprinklers, hydrants, hose reels, and foam systems for active fire suppression.',
    'Detection and notification equipment — smoke/heat detectors, control panels, and alarms.',
    'Electric, diesel, and jockey pumps that supply pressurized water to fire suppression systems.',
    'Water storage, foam, and pressure tanks that supply fire fighting systems.'
  );

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.partner_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    assigned_by TEXT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT partner_products_unique UNIQUE (partner_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_products_partner_id ON public.partner_products(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_products_product_id ON public.partner_products(product_id);

ALTER TABLE public.inquiry_items
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Real enforcement: an inquiry_item can only reference a product that is
-- actually assigned to that inquiry's partner. Runs regardless of whether the
-- insert came from the Express backend or a direct Supabase call.
-- ---------------------------------------------------------------------------
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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_inquiry_item_product_assignment ON public.inquiry_items;
CREATE TRIGGER trg_enforce_inquiry_item_product_assignment
    BEFORE INSERT OR UPDATE OF product_id ON public.inquiry_items
    FOR EACH ROW EXECUTE PROCEDURE public.enforce_inquiry_item_product_assignment();

-- ---------------------------------------------------------------------------
-- Storage bucket for category/product images (public read; admin uploads
-- from the browser).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "products_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "products_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "products_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "products_storage_delete" ON storage.objects;

CREATE POLICY "products_storage_read" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "products_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products');
CREATE POLICY "products_storage_update" ON storage.objects FOR UPDATE USING (bucket_id = 'products') WITH CHECK (bucket_id = 'products');
CREATE POLICY "products_storage_delete" ON storage.objects FOR DELETE USING (bucket_id = 'products');

-- ---------------------------------------------------------------------------
-- RLS — permissive defaults for app JWT via anon key (DEV), matching every
-- other anon-key table in this codebase (quotations, site_assessments,
-- sticker_usage_history, ...). Real isolation for "Partner A can't see
-- Partner B's products" is enforced server-side in GET /partners/products
-- (backend/services/partnerService.js), which derives the partner id from
-- the verified JWT rather than trusting a client-supplied id. Real isolation
-- for "Agent can't select an unassigned product" is the DB trigger above.
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_all" ON public.categories;
DROP POLICY IF EXISTS "categories_update_all" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_all" ON public.categories;

CREATE POLICY "categories_select_all" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_insert_all" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "categories_update_all" ON public.categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "categories_delete_all" ON public.categories FOR DELETE USING (true);

DROP POLICY IF EXISTS "products_select_all" ON public.products;
DROP POLICY IF EXISTS "products_insert_all" ON public.products;
DROP POLICY IF EXISTS "products_update_all" ON public.products;
DROP POLICY IF EXISTS "products_delete_all" ON public.products;

CREATE POLICY "products_select_all" ON public.products FOR SELECT USING (true);
CREATE POLICY "products_insert_all" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update_all" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "products_delete_all" ON public.products FOR DELETE USING (true);

DROP POLICY IF EXISTS "partner_products_select_all" ON public.partner_products;
DROP POLICY IF EXISTS "partner_products_insert_all" ON public.partner_products;
DROP POLICY IF EXISTS "partner_products_update_all" ON public.partner_products;
DROP POLICY IF EXISTS "partner_products_delete_all" ON public.partner_products;

CREATE POLICY "partner_products_select_all" ON public.partner_products FOR SELECT USING (true);
CREATE POLICY "partner_products_insert_all" ON public.partner_products FOR INSERT WITH CHECK (true);
CREATE POLICY "partner_products_update_all" ON public.partner_products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "partner_products_delete_all" ON public.partner_products FOR DELETE USING (true);

COMMIT;
