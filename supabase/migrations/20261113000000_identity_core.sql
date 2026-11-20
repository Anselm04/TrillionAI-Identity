-- Role authority belongs exclusively to the service-role backend.
create table if not exists public.identity_global_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin')),
  granted_at timestamptz not null default now()
);
create unique index if not exists identity_one_owner on public.identity_global_roles ((role)) where role='owner';
alter table public.identity_global_roles enable row level security;
revoke all on public.identity_global_roles from anon, authenticated;

create table if not exists public.identity_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);
alter table public.identity_audit_log enable row level security;
revoke all on public.identity_audit_log from anon, authenticated;

create table if not exists public.identity_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.identity_profiles enable row level security;
revoke all on public.identity_profiles from anon, authenticated;

-- No SECURITY DEFINER triggers exposed in public. Profiles are created
-- lazily when first updated, preventing hidden signup-trigger failures.

grant select, insert, update, delete on public.identity_profiles, public.identity_global_roles to service_role;
grant select, insert on public.identity_audit_log to service_role;
grant usage on sequence public.identity_audit_log_id_seq to service_role;
