-- Disposable CI-only database. Not a Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
create table public.identity_global_roles(
 user_id uuid primary key references auth.users(id),role text not null
);
create unique index identity_one_owner on public.identity_global_roles(role) where role='owner';
create table public.identity_audit_log(
 id bigint generated always as identity primary key,
 user_id uuid,action text not null,created_at timestamptz default now()
);
grant select on public.identity_global_roles to service_role;
grant insert,select on public.identity_audit_log to service_role;
grant usage on sequence public.identity_audit_log_id_seq to service_role;
create function public.identity_session_active(p_user uuid,p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $session$ select exists(select 1 from auth.sessions
  where id=p_session and user_id=p_user and (not_after is null or not_after>now())); $session$;
revoke all on function public.identity_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_session_active(uuid,uuid) to service_role;
