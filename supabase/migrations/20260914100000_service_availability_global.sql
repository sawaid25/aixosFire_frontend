-- Admin-level global service availability — a master switch per
-- (service_type, service_subtype) that ANDs with the existing per-partner
-- setting in partner_service_availability. Deliberately a plain sibling
-- table (same service_type/service_subtype vocabulary, no translation layer
-- needed anywhere), not a NULL-partner row hack in that table, and not a
-- JSONB blob — matches this codebase's small-dedicated-table convention.
--
-- Unlike partner_service_availability ("missing row = enabled" for a brand
-- new partner who hasn't configured anything yet), this global table seeds
-- all 6 combos explicitly — a singleton admin setting should never be
-- ambiguous, the Admin page should always show a definite state.

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type TEXT NOT NULL CHECK (service_type IN ('Validation', 'Refill', 'New Unit', 'Maintenance')),
    service_subtype TEXT NOT NULL DEFAULT 'default'
        CHECK (service_subtype IN ('default', 'new', 'followup', 'license-renewal')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT service_availability_unique UNIQUE (service_type, service_subtype)
);

INSERT INTO public.service_availability (service_type, service_subtype) VALUES
    ('Validation', 'new'),
    ('Validation', 'followup'),
    ('Validation', 'license-renewal'),
    ('Refill', 'new'),
    ('Refill', 'followup'),
    ('Refill', 'license-renewal'),
    ('New Unit', 'default'),
    ('Maintenance', 'default')
ON CONFLICT (service_type, service_subtype) DO NOTHING;

ALTER TABLE public.service_availability ENABLE ROW LEVEL SECURITY;

-- Read is safe to leave open — the Agent form, the Partner's own Manage Services page, and the
-- inquiry-creation pre-check all need to read this with the anon key (no Supabase Auth session
-- exists for any role in this app).
CREATE POLICY "service_availability_select_all"
    ON public.service_availability FOR SELECT USING (true);

-- Deliberately NO insert/update/delete policy: with RLS enabled and no policy for those commands,
-- the anon key cannot write this table at all. Only the Express backend can, via the service-role
-- key (which bypasses RLS) — see backend/routes/admin.js — behind requireRole('admin'). Same trust
-- model as partner_service_availability's write protection.

COMMIT;
