-- Inquiry event log (status history / timeline).
--
-- Why a new table: nothing today records what happened to an inquiry and when.
-- The Customer dashboard timeline (src/pages/customer/dashboardUtils.js
-- buildInquiryTimeline) is reconstructed client-side from created_at and
-- quotations only, so accept/reject/in-progress/complete, partner assignment,
-- visit scheduling and delivery events never appear. audit_logs exists but only
-- covers admin impersonation and has no inquiry/status fields.
--
-- One row per action. Writers:
--   * 'created'  — the AFTER INSERT trigger below, for EVERY creation path (the
--                  Express backend's createFullInquiry AND the Agent flow's direct
--                  browser insert in src/api/inquirySupabase.js). Doing it in the
--                  DB is the only way to cover the browser path without granting
--                  the anon role write access to this table, and it guarantees
--                  exactly one 'created' row (the backend does not also write one).
--   * everything else — backend/services/inquiryEvents.js recordInquiryEvent(),
--                  called by the Express backend (service-role key).
--
-- actor_id is TEXT, not UUID: customers/agents/admins use integer ids while
-- partners use UUIDs (same reason notifications.sender_id/recipient_id are text).
--
-- RLS: enabled with NO policies, so the anon/authenticated roles can neither read
-- nor write it. Reads go through the backend (service role bypasses RLS). The
-- trigger function is SECURITY DEFINER so a browser-side inquiry insert can still
-- record its 'created' event.
--
-- The trigger never blocks inquiry creation: any failure is downgraded to a
-- WARNING and the inquiry insert proceeds.

BEGIN;

CREATE TABLE IF NOT EXISTS public.inquiry_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id  UUID NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    from_status TEXT,
    to_status   TEXT,
    actor_id    TEXT,
    actor_role  TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_events_inquiry_created
    ON public.inquiry_events (inquiry_id, created_at);

ALTER TABLE public.inquiry_events ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies (see header).

CREATE OR REPLACE FUNCTION public.record_inquiry_created_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_role TEXT;
    v_actor_id   TEXT;
BEGIN
    -- Attribute creation from the row itself (performed_by is 'Agent' / 'Customer'
    -- / 'Assigned Partner'; older rows may be null).
    IF NEW.agent_id IS NOT NULL THEN
        v_actor_role := 'agent';
        v_actor_id   := NEW.agent_id::text;
    ELSIF lower(coalesce(NEW.performed_by, '')) = 'customer' THEN
        v_actor_role := 'customer';
        v_actor_id   := NEW.customer_id::text;
    END IF;

    BEGIN
        INSERT INTO public.inquiry_events (inquiry_id, event_type, to_status, actor_id, actor_role, metadata)
        VALUES (
            NEW.id,
            'created',
            NEW.status,
            v_actor_id,
            v_actor_role,
            jsonb_build_object(
                'type', NEW.type,
                'partner_id', NEW.partner_id,
                'is_general_inquiry', NEW.is_general_inquiry
            )
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'record_inquiry_created_event failed for inquiry %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inquiries_created_event ON public.inquiries;
CREATE TRIGGER trg_inquiries_created_event
    AFTER INSERT ON public.inquiries
    FOR EACH ROW EXECUTE FUNCTION public.record_inquiry_created_event();

COMMIT;
