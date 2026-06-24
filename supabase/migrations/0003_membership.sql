-- ============================================================
-- Membership / subscriptions (Stripe Billing)
-- ============================================================

alter table public.profiles
  add column if not exists subscription_tier text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_period_end timestamptz;

create index if not exists profiles_stripe_customer_idx on public.profiles(stripe_customer_id);
create index if not exists profiles_stripe_subscription_idx on public.profiles(stripe_subscription_id);

-- Subscription state is managed only by the system (the Stripe webhook, which
-- runs as service_role). Block authenticated users from self-granting membership.
create or replace function public.prevent_subscription_self_change()
returns trigger language plpgsql as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and (new.subscription_tier is distinct from old.subscription_tier
       or new.subscription_status is distinct from old.subscription_status
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.subscription_period_end is distinct from old.subscription_period_end) then
    raise exception 'subscription fields are managed by the system';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_subscription_self_change on public.profiles;
create trigger prevent_subscription_self_change
  before update on public.profiles
  for each row execute function public.prevent_subscription_self_change();
