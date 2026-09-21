-- Which Admin(s) to notify when an Agent creates a General Inquiry. Exposed as an RPC
-- (SECURITY DEFINER) rather than a direct SELECT on public.admins, since that table
-- holds password hashes and must never be readable via the anon key. This keeps the
-- notification step working the same way createInquiryViaSupabase itself does — a
-- direct Supabase call, no dependency on the Express backend being reachable (that
-- module exists specifically because the backend sometimes isn't, see its docstring).
--
-- Falls back to every admin id when none are explicitly opted in (see
-- PUT /api/admin/general-inquiry-admins), so a General Inquiry is never silently
-- unrouted just because no one has configured routing yet.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_general_inquiry_recipient_ids()
RETURNS TABLE (id BIGINT)
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
