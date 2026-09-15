-- Migration: create payments table for YooMoney integration
-- Apply manually in Supabase SQL editor.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null,
  plan_name text not null,
  credits integer not null,
  amount integer not null,
  currency text not null default 'RUB',
  status text not null default 'pending',
  yoomoney_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not idx_payments_user_id on public.payments (user_id);
create index if not idx_payments_status on public.payments (status);

alter table public.payments enable row level security;

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
    on public.payments
    for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can insert own payments"
    on public.payments
    for insert
    with check (auth.uid() = user_id);

create or replace function public.set_updated_at_payments()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_payments on public.payments;
create trigger set_updated_at_payments
    before update on public.payments
    for each row
    execute function public.set_updated_at_payments();
