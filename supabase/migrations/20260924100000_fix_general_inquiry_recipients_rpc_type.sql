-- Bug fix: 20260917120000_general_inquiry_recipients_rpc.sql declared
-- `RETURNS TABLE (id BIGINT)`, but public.admins.id is actually `integer` in this
-- database, not bigint. Postgres rejects that mismatch on every call
-- ("structure of query does not match function result type"), which the
-- try/catch around it in createInquiryViaSupabase (src/api/inquirySupabase.js)
-- swallows silently — so every General Inquiry was created successfully, but the
-- Admin notification step failed every single time with no visible error.
--
-- CREATE OR REPLACE cannot change a function's return type, so the old one must be
-- dropped first.

BEGIN;

DROP FUNCTION IF EXISTS public.get_general_inquiry_recipient_ids();

CREATE FUNCTION public.get_general_inquiry_recipient_ids()
RETURNS TABLE (id INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY SELECT a.id FROM public.admins a WHERE a.receives_general_inquiries = true;

    IF NOT FOUND THEN
        RETURN QUERY SELECT a.id FROM public.admins a;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_general_inquiry_recipient_ids() TO anon, authenticated;

COMMIT;
