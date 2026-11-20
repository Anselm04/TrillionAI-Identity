-- Installation source; apply only to the Identity database.
begin;
create table if not exists public.identity_stripe_customers (
 user_id uuid primary key references auth.users(id) on delete restrict,
 stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now()
);
alter table public.identity_stripe_customers enable row level security;
revoke all on public.identity_stripe_customers from public,anon,authenticated;
grant select,insert,update,delete on public.identity_stripe_customers to service_role;
commit;
