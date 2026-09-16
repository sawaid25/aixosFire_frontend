-- Partner Chat Management — Admin-controlled, per Partner + Service (Maintenance,
-- New Unit, License Renewal). Two independent switches per row: Chat with Agent,
-- Chat with Customer. A missing row means both enabled — identical to today's
-- unrestricted behavior, so deploying this with an empty table changes nothing
-- until Admin actively disables something. No backfill needed.
--
-- Not the same shape as partner_service_availability (service_type/service_subtype
-- pair, needed for Validation/Refill's 3 sub-modes each) — this feature is scoped
-- to exactly 3 flat services with two independent booleans per row, so a plain
-- `service` enum column is the correct fit here.

BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_chat_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    service TEXT NOT NULL CHECK (service IN ('Maintenance', 'New Unit', 'License Renewal')),
    chat_with_agent BOOLEAN NOT NULL DEFAULT true,
    chat_with_customer BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT partner_chat_settings_unique UNIQUE (partner_id, service)
);

CREATE INDEX IF NOT EXISTS partner_chat_settings_partner_id_idx
    ON public.partner_chat_settings (partner_id);

ALTER TABLE public.partner_chat_settings ENABLE ROW LEVEL SECURITY;

-- Read is safe to leave open — Partner-side inquiry detail pages (anon key, no
-- Supabase Auth session exists for any role in this app) need to read their own
-- settings to decide whether to render each chat trigger at all.
CREATE POLICY "partner_chat_settings_select_all"
    ON public.partner_chat_settings FOR SELECT USING (true);

-- Deliberately NO insert/update/delete policy: only the Express admin route
-- (service-role key, requireRole('admin')) can write — same trust model as
-- partner_service_availability / service_availability.

COMMIT;
