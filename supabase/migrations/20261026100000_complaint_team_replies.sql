-- Internal Team complaint replies: who on the support side sent a message.
-- Run this in the Supabase SQL Editor after 20261024100000_internal_team_access.sql.
-- Idempotent.
--
-- complaints rows from the support side keep is_admin = true (unread counts, the
-- notification bell and the "recent human reply" check all key on it). A reply sent
-- by an internal team member also records that member, so the conversation shows
-- their name/designation instead of "Admin". Name and designation are a snapshot at
-- send time, so history stays accurate if the member's designation changes later.
-- Rows without sender_team_member_id are Admin / AI / user messages, unchanged.

ALTER TABLE public.complaints
    ADD COLUMN IF NOT EXISTS sender_team_member_id bigint
        REFERENCES public.internal_team_members(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sender_name text,
    ADD COLUMN IF NOT EXISTS sender_designation text;

CREATE INDEX IF NOT EXISTS idx_complaints_sender_team_member
    ON public.complaints (sender_team_member_id)
    WHERE sender_team_member_id IS NOT NULL;

-- The browser writes complaints with the anon key, so without this anyone could insert
-- a row claiming to be a team member. Only the backend (service_role) may set these
-- columns; on any other insert/update they are cleared or kept as they were.
CREATE OR REPLACE FUNCTION public.complaints_guard_team_sender()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.sender_team_member_id := NULL;
        NEW.sender_name := NULL;
        NEW.sender_designation := NULL;
    ELSE
        NEW.sender_team_member_id := OLD.sender_team_member_id;
        NEW.sender_name := OLD.sender_name;
        NEW.sender_designation := OLD.sender_designation;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaints_guard_team_sender ON public.complaints;
CREATE TRIGGER trg_complaints_guard_team_sender
    BEFORE INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.complaints_guard_team_sender();
