-- Admin Impersonation ("Login as Agent") feature tables
-- Run this in the Supabase SQL Editor. All statements are idempotent.
--
-- Assumes agents.id and admins.id are bigint (bigserial), matching the
-- convention used by senior_agents/senior_agent_teams in
-- 20260627000000_senior_agents.sql. Adjust the column types below if your
-- admins table uses a different id type (e.g. uuid).

CREATE TABLE IF NOT EXISTS impersonation_sessions (
    id           bigserial PRIMARY KEY,
    admin_id     bigint NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    agent_id     bigint NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    started_at   timestamptz NOT NULL DEFAULT now(),
    ended_at     timestamptz,
    end_reason   text CHECK (end_reason IN ('manual', 'expired', 'forced', 'error')),
    ip_address   text,
    user_agent   text
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_agent  ON impersonation_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin  ON impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active ON impersonation_sessions(ended_at) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
    id                        bigserial PRIMARY KEY,
    actor_user_id             bigint NOT NULL,
    actor_role                text NOT NULL,
    acting_as_user_id         bigint,
    acting_as_role            text,
    impersonation_session_id  bigint REFERENCES impersonation_sessions(id) ON DELETE SET NULL,
    action                    text NOT NULL,
    method                    text NOT NULL,
    path                      text NOT NULL,
    resource_id               text,
    metadata                  jsonb,
    created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonation ON audit_logs(impersonation_session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor         ON audit_logs(actor_user_id);

-- Disable RLS so both the backend (service-role key) and the frontend
-- "Impersonation Activity" panel (anon key, read-only usage) can access these
-- tables, consistent with how agents/inquiries/senior_agents work in this
-- project. Writes only ever happen from the backend.
ALTER TABLE impersonation_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             DISABLE ROW LEVEL SECURITY;
