-- Migration: add robokassa_inv_id column for Robokassa integration
-- Apply manually in Supabase SQL editor.

alter table public.payments
  add column if not exists robokassa_inv_id bigint;

create unique index if not exists idx_payments_robokassa_inv_id
  on public.payments (robokassa_inv_id)
  where robokassa_inv_id is not null;