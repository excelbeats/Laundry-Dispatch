-- ============================================================
-- Payments: track Stripe payment state on orders
-- ============================================================

do $$ begin
  create type public.payment_status as enum ('unpaid', 'processing', 'paid', 'refunded');
exception when duplicate_object then null; end $$;

alter table public.orders add column if not exists payment_status public.payment_status not null default 'unpaid';
alter table public.orders add column if not exists stripe_session_id text;
alter table public.orders add column if not exists stripe_payment_intent text;
alter table public.orders add column if not exists paid_at timestamptz;

create index if not exists orders_stripe_session_idx on public.orders(stripe_session_id);
