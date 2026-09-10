-- Partner Service Availability — lets each Partner control which inquiry
-- types/sub-types they accept. A missing row means "enabled" (see the
-- migration comment below and the application code that reads this table) —
-- deliberately no backfill for existing partners, since an empty table is
-- already equivalent to today's behavior (everyone eligible for everything).

BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_service_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('Validation', 'Refill', 'New Unit', 'Maintenance')),
    -- 'default' for New Unit/Maintenance (no sub-type). 'new'/'followup'/'license-renewal' for
    -- Validation and Refill — these exact strings already match inquiry_items.validation_mode,
    -- so no translation layer is needed anywhere this table gets checked.
    service_subtype TEXT NOT NULL DEFAULT 'default'
        CHECK (service_subtype IN ('default', 'new', 'followup', 'license-renewal')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT partner_service_availability_unique UNIQUE (partner_id, service_type, service_subtype)
);

CREATE INDEX IF NOT EXISTS partner_service_availability_partner_id_idx
    ON public.partner_service_availability (partner_id);

ALTER TABLE public.partner_service_availability ENABLE ROW LEVEL SECURITY;

-- Read is safe to leave open — the Agent form (anon key, no Supabase Auth session exists for any
-- role in this app) needs to read every partner's availability to filter its Partner dropdown.
CREATE POLICY "partner_service_availability_select_all"
    ON public.partner_service_availability FOR SELECT USING (true);

-- Deliberately NO insert/update/delete policy: with RLS enabled and no policy for those commands,
-- the anon key cannot write this table at all. Only the Express backend can, via the service-role
-- key (which bypasses RLS) — see backend/controllers/partnerController.js — after verifying the
-- caller's JWT identifies them as the partner_id being written. This is the only place a partner's
-- own service-availability rows can be changed, so Partner A can never touch Partner B's settings.

COMMIT;
