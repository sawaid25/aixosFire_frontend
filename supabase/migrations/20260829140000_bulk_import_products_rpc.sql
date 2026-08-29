-- Transactional bulk product import for the Admin "Bulk Upload (CSV)" flow.
--
-- The Admin page (src/pages/admin/BulkImportProducts.jsx) parses + validates
-- the CSV entirely in the browser (category exists, no duplicates, valid
-- status/specs/image, etc.), shows a preview, and only then calls this
-- function with the resolved operations. Doing the writes here — inside a
-- single function body, which Postgres runs as one transaction — is what
-- guarantees the requirement "do not partially import": if any row fails,
-- every insert/update in the batch is rolled back and nothing changes.
--
-- The function re-checks the things that matter for integrity (category still
-- exists, an "update" target row still exists) so a stale browser tab can't
-- corrupt data. It never creates categories.
--
-- Input: p_items — a JSONB array, each element:
--   {
--     "op":             "create" | "update",
--     "id":             "<uuid>" | null,          -- required when op = update
--     "category_id":    "<uuid>",
--     "name":           "text",
--     "model_number":   "text" | null,
--     "description":    "text" | null,
--     "image_url":      "text" | null,            -- null/"" on update = keep existing
--     "specifications": { ... } | null,
--     "is_active":      true | false | null       -- null = default true (create) / keep (update)
--   }
--
-- Returns: { "created": int, "updated": int, "processed": int }

BEGIN;

CREATE OR REPLACE FUNCTION public.bulk_import_products(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item        jsonb;
    v_op          text;
    v_id          uuid;
    v_category_id uuid;
    v_is_active   boolean;
    v_image       text;
    v_created     int := 0;
    v_updated     int := 0;
    v_index       int := 0;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'bulk_import_products: expected a JSON array of items';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'bulk_import_products: nothing to import';
    END IF;

    IF jsonb_array_length(p_items) > 500 THEN
        RAISE EXCEPTION 'bulk_import_products: too many rows (% ) — limit is 500', jsonb_array_length(p_items);
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_index := v_index + 1;
        v_op          := lower(coalesce(v_item->>'op', ''));
        v_category_id := nullif(v_item->>'category_id', '')::uuid;

        IF v_category_id IS NULL THEN
            RAISE EXCEPTION 'item %: category_id is missing', v_index;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = v_category_id) THEN
            RAISE EXCEPTION 'item %: category % no longer exists', v_index, v_category_id;
        END IF;

        IF coalesce(btrim(v_item->>'name'), '') = '' THEN
            RAISE EXCEPTION 'item %: product name is empty', v_index;
        END IF;

        IF v_item->>'is_active' IS NULL THEN
            v_is_active := NULL;
        ELSE
            v_is_active := (v_item->>'is_active')::boolean;
        END IF;

        v_image := nullif(v_item->>'image_url', '');

        IF v_op = 'update' THEN
            v_id := nullif(v_item->>'id', '')::uuid;
            IF v_id IS NULL THEN
                RAISE EXCEPTION 'item %: update requires an id', v_index;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_id) THEN
                RAISE EXCEPTION 'item %: product % no longer exists', v_index, v_id;
            END IF;

            UPDATE public.products SET
                category_id    = v_category_id,
                name           = btrim(v_item->>'name'),
                model_number   = nullif(btrim(coalesce(v_item->>'model_number', '')), ''),
                description     = nullif(btrim(coalesce(v_item->>'description', '')), ''),
                specifications = CASE
                                     WHEN v_item->'specifications' IS NULL
                                          OR jsonb_typeof(v_item->'specifications') = 'null'
                                     THEN NULL
                                     ELSE v_item->'specifications'
                                 END,
                image_url      = COALESCE(v_image, image_url),   -- blank cell = keep existing
                is_active      = COALESCE(v_is_active, is_active)
            WHERE id = v_id;

            v_updated := v_updated + 1;

        ELSIF v_op = 'create' THEN
            INSERT INTO public.products
                (category_id, name, model_number, description, specifications, image_url, is_active)
            VALUES (
                v_category_id,
                btrim(v_item->>'name'),
                nullif(btrim(coalesce(v_item->>'model_number', '')), ''),
                nullif(btrim(coalesce(v_item->>'description', '')), ''),
                CASE
                    WHEN v_item->'specifications' IS NULL
                         OR jsonb_typeof(v_item->'specifications') = 'null'
                    THEN NULL
                    ELSE v_item->'specifications'
                END,
                v_image,
                COALESCE(v_is_active, true)
            );

            v_created := v_created + 1;

        ELSE
            RAISE EXCEPTION 'item %: unknown op "%"', v_index, v_op;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'created',   v_created,
        'updated',   v_updated,
        'processed', v_created + v_updated
    );
END;
$$;

-- App uses the anon key for all DB access (see 20260822120000_products_catalog.sql).
-- Admin-only enforcement is the client route guard (ProtectedRoute allowedRoles
-- ['admin']) + the fact that this flow is only reachable from the Admin UI,
-- consistent with every other write path in this project.
GRANT EXECUTE ON FUNCTION public.bulk_import_products(jsonb) TO anon, authenticated;

COMMIT;
