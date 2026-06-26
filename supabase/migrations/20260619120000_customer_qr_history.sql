-- Customer QR Code History
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times (all statements are idempotent).

-- Create table if it does not exist yet
create table if not exists customer_qr_history (
    id           bigserial primary key,
    customer_id  bigint references customers(id) on delete cascade,
    version      int,
    qr_data_url  text,
    qr_url_value text,
    qr_payload   jsonb,
    generated_at timestamptz not null default now(),
    generated_by text,
    reason       text default 'Initial Customer Creation'
);

-- Add qr_payload column if the table was created by an older migration
alter table customer_qr_history
    add column if not exists qr_payload jsonb;

create index if not exists idx_cqr_customer on customer_qr_history(customer_id);
