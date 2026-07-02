-- Senior Agent feature tables
-- Run this in the Supabase SQL Editor. All statements are idempotent.

-- ── Senior agents (one record per promoted agent) ──────────────────────────
CREATE TABLE IF NOT EXISTS senior_agents (
    id               bigserial PRIMARY KEY,
    agent_id         bigint NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
    activation_token text,
    token_expires_at timestamptz,
    pin_hash         text,
    is_activated     boolean NOT NULL DEFAULT false,
    promoted_by      text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Team assignments (up to 10 agents per senior agent) ───────────────────
CREATE TABLE IF NOT EXISTS senior_agent_teams (
    id              bigserial PRIMARY KEY,
    senior_agent_id bigint NOT NULL REFERENCES senior_agents(id) ON DELETE CASCADE,
    agent_id        bigint NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    assigned_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (senior_agent_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_senior_agents_agent_id ON senior_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_sat_senior_agent_id    ON senior_agent_teams(senior_agent_id);
CREATE INDEX IF NOT EXISTS idx_sat_member_agent_id    ON senior_agent_teams(agent_id);

-- Disable RLS so the frontend anon key can read/write these tables
-- (consistent with how agents, inquiries, customers tables work in this project)
ALTER TABLE senior_agents      DISABLE ROW LEVEL SECURITY;
ALTER TABLE senior_agent_teams DISABLE ROW LEVEL SECURITY;
