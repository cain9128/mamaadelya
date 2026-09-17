-- credits is the total balance; permanent_credits is its non-expiring portion.
alter table public.profiles
  add column if not exists permanent_credits integer not null default 0
  check (permanent_credits >= 0);

create or replace function public.consume_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.profiles%rowtype;
  available integer;
begin
  select * into account from public.profiles where id = p_user_id for update;
  available := case
    when account.subscription_expires_at <= now() then account.permanent_credits
    else account.credits
  end;
  if available is null or available <= 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  -- Spend expiring credits first, preserving the permanent portion until needed.
  update public.profiles
  set credits = available - 1,
      permanent_credits = least(account.permanent_credits, available - 1)
  where id = p_user_id;
  return available - 1;
end;
$$;

create or replace function public.burn_expired_credits()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set credits = permanent_credits
  where subscription_expires_at <= now() and credits > permanent_credits;
end;
$$;

-- Both Robokassa callbacks use this transaction after verifying the signature.
-- A row lock makes simultaneous callbacks idempotent. Failures roll back everything.
create or replace function public.complete_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.payments%rowtype;
  account public.profiles%rowtype;
  available integer;
begin
  select * into payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if payment.status = 'completed' then
    return jsonb_build_object('alreadyProcessed', true);
  end if;
  if payment.status <> 'pending' or payment.credits <= 0 then
    raise exception 'Invalid payment';
  end if;
  if payment.plan_id = 'tokens3' and (payment.credits <> 3 or payment.amount <> 270) then
    raise exception 'Invalid token package';
  end if;

  select * into account from public.profiles where id = payment.user_id for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  available := case
    when account.subscription_expires_at <= now() then account.permanent_credits
    else account.credits
  end;

  if payment.plan_id = 'tokens3' then
    update public.profiles
    set credits = available + payment.credits,
        permanent_credits = permanent_credits + payment.credits
    where id = payment.user_id;
  else
    update public.profiles
    set credits = available + payment.credits,
        plan = payment.plan_name,
        subscription_expires_at = now() + interval '30 days'
    where id = payment.user_id;
  end if;

  update public.payments set status = 'completed' where id = p_payment_id;
  return jsonb_build_object('alreadyProcessed', false);
end;
$$;

revoke all on function public.complete_payment(uuid) from public, anon, authenticated;
grant execute on function public.complete_payment(uuid) to service_role;
