-- Installation source; apply only to the Identity database.
begin;
create table if not exists public.identity_stripe_customers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now()
);
alter table public.identity_stripe_customers enable row level security;
revoke all on public.identity_stripe_customers from public,anon,authenticated;
grant select,insert,update,delete on public.identity_stripe_customers to service_role;
-- Durable idempotent event receipt; no entitlement is granted from an event payload.
create table if not exists public.identity_stripe_events (
 event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]+$'),
 customer_id text not null check (customer_id ~ '^cus_[A-Za-z0-9]+$'),
 subscription_id text not null check (subscription_id ~ '^sub_[A-Za-z0-9]+$'),
 event_created bigint not null,
 status text not null,
 live_mode boolean not null,
 received_at timestamptz not null default now()
);
alter table public.identity_stripe_events enable row level security;
revoke all on public.identity_stripe_events from public,anon,authenticated;
grant select,insert on public.identity_stripe_events to service_role;
create index if not exists identity_stripe_events_customer_idx on public.identity_stripe_events(customer_id,event_created desc);
-- Atomic export of Identity-owned private billing metadata, never credentials.
create or replace function public.identity_export_billing(p_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $export$
 select jsonb_build_object('stripe_customer_id',c.stripe_customer_id,
 'events',coalesce((select jsonb_agg(jsonb_build_object('subscription_id',e.subscription_id,'status',e.status,'event_created',e.event_created) order by e.event_created) from public.identity_stripe_events e where e.customer_id=c.stripe_customer_id),'[]'::jsonb))
 from public.identity_stripe_customers c where c.user_id=p_user;
$export$;
revoke all on function public.identity_export_billing(uuid) from public,anon,authenticated;
grant execute on function public.identity_export_billing(uuid) to service_role;
-- Remove the customer association only through the final auth.users deletion cascade.
-- Event receipts remain pseudonymous billing records for deduplication/accounting.
commit;
