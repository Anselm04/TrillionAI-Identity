-- Identity-only loss-of-all-factors intake. NEVER grants or resets MFA.
-- The Identity backend supplies p_actor only after validating the user's
-- Supabase bearer and active session. No public/anon/authenticated privileges.
begin;
create table if not exists public.identity_mfa_recovery_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_role text not null check (requested_role in ('customer','admin','owner')),
  session_id uuid not null,
  status text not null default 'pending' check (status in ('pending','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint identity_recovery_closed_consistent check (
    (status='pending' and closed_at is null) or
    (status='closed' and closed_at is not null))
);
alter table public.identity_mfa_recovery_requests enable row level security;
revoke all on table public.identity_mfa_recovery_requests from public, anon, authenticated;
grant select, insert on table public.identity_mfa_recovery_requests to service_role;

create or replace function public.identity_request_mfa_recovery(
  p_actor uuid, p_session uuid, p_role text
) returns boolean language plpgsql security invoker set search_path='' as $intake$
declare inserted_count integer;
begin
  if p_actor is null or p_session is null or p_role not in ('customer','admin','owner') then
    return false;
  end if;
  insert into public.identity_mfa_recovery_requests(user_id,session_id,requested_role)
    values(p_actor,p_session,p_role) on conflict (user_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    insert into public.identity_audit_log(user_id,action)
      values(p_actor,'mfa_recovery_requested');
  end if;
  return true;
end;
$intake$;
revoke all on function public.identity_request_mfa_recovery(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.identity_request_mfa_recovery(uuid,uuid,text) to service_role;
commit;
