-- Admin Per-Partner Service Control — extends the existing partner_service_availability
-- table (already partner+service keyed) rather than creating a new table. Adds a second,
-- independent flag: admin_enabled is the Admin's per-partner override; is_enabled keeps
-- its existing meaning (the Partner's own preference). This is ADDITIVE to the two layers
-- that already exist (this table's is_enabled, and the system-wide service_availability
-- table/trigger check from 20260914100000) — nothing about either of those changes.
--
-- Effective availability = global service_availability.is_enabled AND this row's
-- admin_enabled AND this row's is_enabled.
--
-- Migration safety: defaults to true on every existing row, and the app-wide "missing
-- row = enabled" convention applies to it too — so this changes nothing for any existing
-- Partner until an Admin explicitly disables something for them specifically.

BEGIN;

ALTER TABLE public.partner_service_availability
    ADD COLUMN IF NOT EXISTS admin_enabled BOOLEAN NOT NULL DEFAULT true;

COMMIT;
