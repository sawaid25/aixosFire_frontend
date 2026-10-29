-- Lock the admins table away from the browser.
-- Run this in the Supabase SQL Editor. Idempotent.
--
-- The anon key ships in the frontend bundle, and before this the anon role could
-- SELECT public.admins — including the password column. Nothing in the frontend reads
-- or writes admins: every use is in the backend (service-role key, which bypasses RLS
-- and these grants) or in get_general_inquiry_recipient_ids(), which is SECURITY
-- DEFINER and so runs as the table owner. Removing browser access breaks nothing.

REVOKE ALL ON public.admins FROM anon, authenticated;

-- Defence in depth if a grant is ever re-added: RLS on, no policies = no rows.
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
