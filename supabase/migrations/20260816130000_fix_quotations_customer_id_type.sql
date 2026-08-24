-- Fixes a real type mismatch: quotations.customer_id was created as UUID
-- (20260406230000_quotations_setup.sql) with no FK constraint, but every
-- code path that inserts a quotation (InquiryItemDetailPage.jsx ->
-- maintenanceApi.js -> backend/services/maintenanceService.js) always sends
-- the bigint customers.id / inquiries.customer_id value. Postgres rejects a
-- bigint literal inserted into a UUID NOT NULL column immediately with
-- "invalid input syntax for type uuid", so quotation submission has not been
-- functional. sticker_usage_logs.customer_id has the same UUID-vs-bigint
-- mismatch (20260409160000_partner_sticker_tracking.sql) — a REFERENCES
-- clause between incompatible types can't even be created, so if that
-- migration ran verbatim it would already have failed there; this migration
-- fixes the column defensively (IF EXISTS) rather than assuming.
--
-- Guarded against data loss: if the table already holds rows whose
-- customer_id can't be read as a bigint, the ALTER below raises loudly
-- instead of silently dropping/mismapping data, so a human has to look
-- before anything is lost.

BEGIN;

DO $$
DECLARE
    v_bad_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'quotations'
          AND column_name = 'customer_id' AND data_type = 'uuid'
    ) THEN
        SELECT count(*) INTO v_bad_count
        FROM public.quotations
        WHERE customer_id IS NOT NULL
          AND customer_id::text !~ '^[0-9]+$';

        IF v_bad_count > 0 THEN
            RAISE EXCEPTION
                'quotations.customer_id has % row(s) that are not plain integers — cannot safely convert to bigint. Review these rows manually before re-running this migration.',
                v_bad_count;
        END IF;

        ALTER TABLE public.quotations
            ALTER COLUMN customer_id TYPE BIGINT USING (customer_id::text)::bigint;

        ALTER TABLE public.quotations
            ADD CONSTRAINT quotations_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers (id);
    END IF;
END $$;

DO $$
DECLARE
    v_bad_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sticker_usage_logs'
          AND column_name = 'customer_id' AND data_type = 'uuid'
    ) THEN
        SELECT count(*) INTO v_bad_count
        FROM public.sticker_usage_logs
        WHERE customer_id IS NOT NULL
          AND customer_id::text !~ '^[0-9]+$';

        IF v_bad_count > 0 THEN
            RAISE EXCEPTION
                'sticker_usage_logs.customer_id has % row(s) that are not plain integers — cannot safely convert to bigint. Review these rows manually before re-running this migration.',
                v_bad_count;
        END IF;

        ALTER TABLE public.sticker_usage_logs
            DROP CONSTRAINT IF EXISTS sticker_usage_logs_customer_id_fkey;

        ALTER TABLE public.sticker_usage_logs
            ALTER COLUMN customer_id TYPE BIGINT USING (customer_id::text)::bigint;

        ALTER TABLE public.sticker_usage_logs
            ADD CONSTRAINT sticker_usage_logs_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers (id) ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;
