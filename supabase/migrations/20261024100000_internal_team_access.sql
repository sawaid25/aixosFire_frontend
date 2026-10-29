-- Internal Team access (Phase 1).
-- Run this in the Supabase SQL Editor. All statements are idempotent.
--
-- Internal team members are a separate account type (role 'internal_team'), stored
-- next to agents/customers/partners/admins in their own table, exactly like those
-- roles. A row starts as an access request (status 'pending'); Admin approves it,
-- sets a designation and page-level permissions, and can later edit or deactivate it.
--
-- permissions is a JSON object of module -> allowed actions, e.g.
--   { "agents": ["view", "edit"], "complaints": ["view"] }
-- The backend validates it against backend/services/teamPermissions.js
-- (TEAM_PERMISSION_CATALOG), so a new page/action only needs a catalog entry there.

CREATE TABLE IF NOT EXISTS public.internal_team_members (
    id                bigserial PRIMARY KEY,
    name              text NOT NULL,
    email             text NOT NULL,
    password          text NOT NULL,             -- bcrypt hash, never returned by the API
    phone             text,
    department        text,                      -- applicant's own description
    request_note      text,                      -- what the applicant says they need access to
    designation       text,                      -- set by Admin on approval
    status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected', 'deactivated')),
    permissions       jsonb NOT NULL DEFAULT '{}'::jsonb
                      CHECK (jsonb_typeof(permissions) = 'object'),
    rejection_reason  text,
    reviewed_by       bigint REFERENCES public.admins(id) ON DELETE SET NULL,
    reviewed_at       timestamptz,
    last_login_at     timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One account / request per email (case-insensitive). A rejected applicant re-applies
-- by reusing their row (the backend resets it to 'pending'), so no duplicates pile up.
CREATE UNIQUE INDEX IF NOT EXISTS internal_team_members_email_key
    ON public.internal_team_members (lower(email));

CREATE INDEX IF NOT EXISTS idx_internal_team_members_status
    ON public.internal_team_members (status, created_at DESC);

-- RLS ON with no policies: the browser's anon key can neither read nor write this table
-- (it holds password hashes and permissions). Only the backend's service-role key can,
-- and every backend route that touches it is Admin-only or the member's own login.
ALTER TABLE public.internal_team_members ENABLE ROW LEVEL SECURITY;
