-- Run against a disposable Supabase database after all migrations. Rolls back fixtures.
begin;
do $$
declare
  user_id uuid := gen_random_uuid();
  payment_id uuid := gen_random_uuid();
  account public.profiles%rowtype;
  expiry timestamptz := now() + interval '10 days';
  result jsonb;
begin
  insert into auth.users (id) values (user_id);
  insert into public.profiles (id, email, credits, plan, subscription_expires_at)
  values (user_id, user_id::text || '@example.test', 5, 'Креатор', expiry);
  insert into public.payments (id, user_id, plan_id, plan_name, credits, amount)
  values (payment_id, user_id, 'tokens3', '3 токена', 3, 270);

  perform public.complete_payment(payment_id);
  select * into account from public.profiles where id = user_id;
  assert account.credits = 8 and account.permanent_credits = 3, 'package added';
  assert account.plan = 'Креатор' and account.subscription_expires_at = expiry, 'subscription unchanged';
  result := public.complete_payment(payment_id);
  assert (result->>'alreadyProcessed')::boolean, 'duplicate callback detected';
  assert (select credits = 8 from public.profiles where id = user_id), 'no double credit';

  perform public.consume_credit(user_id);
  assert (select credits = 7 and permanent_credits = 3 from public.profiles where id = user_id), 'expiring credits first';
  update public.profiles set subscription_expires_at = now() - interval '31 days' where id = user_id;
  perform public.burn_expired_credits();
  assert (select credits = 3 and permanent_credits = 3 from public.profiles where id = user_id), 'package survives expiration';
  assert public.consume_credit(user_id) = 2, 'usable after expiration';

  payment_id := gen_random_uuid();
  insert into public.payments (id, user_id, plan_id, plan_name, credits, amount)
  values (payment_id, user_id, 'tokens3', '3 токена', 3, 270);
  perform public.complete_payment(payment_id);
  assert (select credits = 5 and permanent_credits = 5 from public.profiles where id = user_id), 'repeat purchase stacks';

  payment_id := gen_random_uuid();
  insert into public.payments (id, user_id, plan_id, plan_name, credits, amount)
  values (payment_id, user_id, 'creator', 'Креатор', 14, 890);
  perform public.complete_payment(payment_id);
  assert (select credits = 19 and permanent_credits = 5 and subscription_expires_at > now()
          from public.profiles where id = user_id), 'subscription preserves permanent credits';
  update public.profiles set subscription_expires_at = now() - interval '31 days' where id = user_id;
  assert public.consume_credit(user_id) = 4, 'expiration handled without periodic job';
  perform public.consume_credit(user_id);
  perform public.consume_credit(user_id);
  perform public.consume_credit(user_id);
  perform public.consume_credit(user_id);
  begin
    perform public.consume_credit(user_id);
    raise exception 'Expected insufficient_credits';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'insufficient_credits' then raise; end if;
  end;

  update public.profiles set credits = 2, permanent_credits = 0,
    plan = 'Старт', subscription_expires_at = null where id = user_id;
  payment_id := gen_random_uuid();
  insert into public.payments (id, user_id, plan_id, plan_name, credits, amount)
  values (payment_id, user_id, 'tokens3', '3 токена', 3, 270);
  perform public.complete_payment(payment_id);
  assert (select credits = 5 and permanent_credits = 3 and plan = 'Старт'
          and subscription_expires_at is null from public.profiles where id = user_id), 'no subscription created';
end;
$$;
rollback;
