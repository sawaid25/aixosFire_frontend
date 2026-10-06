-- Catalog number (CAT No) for every product: AIR-0001, AIR-0002, …
--
-- - products.cat_no: unique, generated — never typed by hand.
-- - Existing products are numbered line by line in the order they were added
--   (created_at, then name, then id to break ties between rows seeded together).
-- - Every new product gets the next number automatically (BEFORE INSERT trigger), so
--   the Admin "Add Product" form, bulk import (bulk_import_products) and any other
--   insert path are covered without code changes.
-- - Numbers are 4 digits minimum and keep growing past AIR-9999 (AIR-10000, …).
--
-- Safe to re-run: already-numbered products keep their CAT No; only products without
-- one are numbered, continuing after the highest existing number.

BEGIN;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS cat_no TEXT;

CREATE SEQUENCE IF NOT EXISTS public.products_cat_no_seq AS BIGINT MINVALUE 1 START 1;

CREATE OR REPLACE FUNCTION public.format_product_cat_no(n BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT 'AIR-' || CASE WHEN length(n::text) < 4 THEN lpad(n::text, 4, '0') ELSE n::text END;
$$;

-- Backfill existing products, continuing after any number already assigned.
WITH base AS (
    SELECT COALESCE(MAX(substring(cat_no FROM '^AIR-(\d+)$')::BIGINT), 0) AS start_at
    FROM public.products
),
ordered AS (
    SELECT p.id,
           (SELECT start_at FROM base) + row_number() OVER (ORDER BY p.created_at, p.name, p.id) AS n
    FROM public.products p
    WHERE p.cat_no IS NULL OR btrim(p.cat_no) = ''
)
UPDATE public.products p
SET cat_no = public.format_product_cat_no(o.n)
FROM ordered o
WHERE p.id = o.id;

-- Continue the sequence after the highest number now in use.
SELECT setval(
    'public.products_cat_no_seq',
    GREATEST(COALESCE((SELECT MAX(substring(cat_no FROM '^AIR-(\d+)$')::BIGINT) FROM public.products), 0), 1),
    COALESCE((SELECT MAX(substring(cat_no FROM '^AIR-(\d+)$')::BIGINT) FROM public.products), 0) > 0
);

CREATE UNIQUE INDEX IF NOT EXISTS products_cat_no_key ON public.products (cat_no);

-- New products: assign the next CAT No when none is given. SECURITY DEFINER so a
-- browser-side insert (Admin "Add Product" form) can use the sequence.
CREATE OR REPLACE FUNCTION public.assign_product_cat_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.cat_no IS NULL OR btrim(NEW.cat_no) = '' THEN
        NEW.cat_no := public.format_product_cat_no(nextval('public.products_cat_no_seq'));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_assign_cat_no ON public.products;
CREATE TRIGGER trg_products_assign_cat_no
    BEFORE INSERT ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.assign_product_cat_no();

-- Every product has one from here on.
ALTER TABLE public.products ALTER COLUMN cat_no SET NOT NULL;

COMMIT;
