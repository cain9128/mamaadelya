-- Migration: add profile fields
-- Apply manually in Supabase SQL editor.

alter table public.profiles
  add column if not exists credits integer not null default 0,
  add column if not exists plan text not null default 'Старт';

-- Atomically consume 1 credit for a user.
-- Returns the remaining credit count, or raises 'insufficient_credits' if none left.
create or replace function public.consume_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
  set credits = credits - 1
  where id = p_user_id and credits > 0
  returning credits into remaining;

  if remaining is null then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  return remaining;
end;
$$;

grant execute on function public.consume_credit(uuid) to anon, authenticated;

-- Add credits to a user's profile (used after purchasing a plan).
-- Returns the new credit balance.
create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0002';
  end if;

  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'Profile not found' using errcode = 'P0003';
  end if;

  return new_balance;
end;
$$;

grant execute on function public.add_credits(uuid, integer) to anon, authenticated;

-- Give existing 'Старт' plan users who have 0 credits an initial 2 free credits
update public.profiles
set credits = 2
where plan = 'Старт' and credits = 0;
