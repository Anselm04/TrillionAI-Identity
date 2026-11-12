-- Tenant membership retained from the previous OIDC foundation, using
-- confirmed Supabase auth.users IDs rather than Keycloak subject strings.
create table if not exists public.identity_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);
create table if not exists public.identity_memberships (
  organisation_id uuid not null references public.identity_organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','staff','customer')),
  status text not null default 'invited' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  primary key (organisation_id,user_id)
);
create index if not exists identity_memberships_active_user_idx
  on public.identity_memberships(user_id) where status='active';
alter table public.identity_organisations enable row level security;
alter table public.identity_memberships enable row level security;
revoke all on public.identity_organisations,public.identity_memberships from anon,authenticated;
-- No client policies. Backend service role must filter by validated caller UID.
