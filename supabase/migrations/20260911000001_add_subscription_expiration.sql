-- Migration: add subscription expiration and fix credit system
-- Apply manually in Supabase SQL editor.

-- Add subscription expiration column
alter table public.profiles
  add column if not exists subscription_expires_at timestamptz;

-- Update consume_credit to check subscription expiration
create or replace function public.consume_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
  sub_expires timestamptz;
begin
  -- Get subscription expiration
  select subscription_expires_at into sub_expires
  from public.profiles
  where id = p_user_id;

  -- Check if subscription is expired (only if user has a paid subscription)
  if sub_expires is not null and sub_expires < now() then
    -- Burn remaining credits
    update public.profiles
    set credits = 0
    where id = p_user_id;
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

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

-- Function to check and burn expired credits (can be called periodically)
create or replace function public.burn_expired_credits()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set credits = 0
  where subscription_expires_at < now()
    and credits > 0
    and subscription_expires_at is not null;
end;
$$;

grant execute on function public.burn_expired_credits() to anon, authenticated;
