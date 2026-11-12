-- Role authority belongs exclusively to the service-role backend.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin')),
  granted_at timestamptz not null default now()
);
create unique index if not exists identity_one_owner on public.user_roles ((role)) where role='owner';
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;

create table if not exists public.identity_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);
alter table public.identity_audit_log enable row level security;
revoke all on public.identity_audit_log from anon, authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

-- No SECURITY DEFINER triggers exposed in public. Profiles are created
-- lazily when first updated, preventing hidden signup-trigger failures.
