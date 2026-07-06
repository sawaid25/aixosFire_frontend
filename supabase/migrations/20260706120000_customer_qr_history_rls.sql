-- Fix: customer_qr_history has RLS enabled (default for tables created via the
-- Supabase dashboard) but was never given any policies, so every insert from
-- the frontend (anon key) fails with 42501 "new row violates row-level
-- security policy". Run this in Supabase SQL Editor.
-- Safe to run multiple times.

ALTER TABLE public.customer_qr_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_qr_history_select_all" ON public.customer_qr_history;
DROP POLICY IF EXISTS "customer_qr_history_insert_all" ON public.customer_qr_history;
DROP POLICY IF EXISTS "customer_qr_history_update_all" ON public.customer_qr_history;
DROP POLICY IF EXISTS "customer_qr_history_delete_all" ON public.customer_qr_history;

-- DEV / anon-key pattern (matches customers, quotations, sticker_usage_history,
-- site_assessments, etc.) — tighten for production if per-role access is needed.
CREATE POLICY "customer_qr_history_select_all" ON public.customer_qr_history
    FOR SELECT USING (true);

CREATE POLICY "customer_qr_history_insert_all" ON public.customer_qr_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "customer_qr_history_update_all" ON public.customer_qr_history
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "customer_qr_history_delete_all" ON public.customer_qr_history
    FOR DELETE USING (true);
