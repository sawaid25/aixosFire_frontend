-- Internal Team invitations: Admin invites by email; only an invited address can register.
-- Run this in the Supabase SQL Editor after 20261024100000_internal_team_access.sql.
-- Idempotent.
--
-- An invitation authorizes registration only. Completing it creates (or reuses) the
-- existing internal_team_members row as 'pending' with no permissions — Admin still
-- approves it and assigns designation/pages on Access Requests, exactly as before.
--
-- The link token is never stored: token_hash is SHA-256 of a 32-byte random token
-- (backend/services/teamInvitations.js). Status is derived:
--   used_at set -> used · revoked_at set -> revoked · expires_at past -> expired · else pending

CREATE TABLE IF NOT EXISTS public.internal_team_invitations (
    id           bigserial PRIMARY KEY,
    email        text NOT NULL,
    token_hash   text NOT NULL UNIQUE,
    invited_by   bigint REFERENCES public.admins(id) ON DELETE SET NULL,
    expires_at   timestamptz NOT NULL,
    sent_at      timestamptz NOT NULL DEFAULT now(),
    send_count   integer NOT NULL DEFAULT 1,
    used_at      timestamptz,
    member_id    bigint REFERENCES public.internal_team_members(id) ON DELETE SET NULL,
    revoked_at   timestamptz,
    revoked_by   bigint REFERENCES public.admins(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- At most one open (not used, not revoked) invitation per email. An expired one stays
-- open until Admin resends it (new token + new expiry) or revokes it.
CREATE UNIQUE INDEX IF NOT EXISTS internal_team_invitations_open_email_key
    ON public.internal_team_invitations (lower(email))
    WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_internal_team_invitations_created
    ON public.internal_team_invitations (created_at DESC);

-- Backend-only (service-role key). RLS on with no policies = the browser's anon key
-- can neither read token hashes nor create invitations.
ALTER TABLE public.internal_team_invitations ENABLE ROW LEVEL SECURITY;
