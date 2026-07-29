-- Password reset OTPs for the custom (non-Supabase-Auth) login tables:
-- agents, customers, admins, partners. Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS password_resets (
    id         bigserial PRIMARY KEY,
    email      text NOT NULL,
    role       text NOT NULL CHECK (role IN ('agent','customer','admin','partner')),
    otp_hash   text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (email, role)
);

-- Only the backend (service-role key) touches this table.
ALTER TABLE password_resets DISABLE ROW LEVEL SECURITY;
