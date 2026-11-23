-- A rejection is NOT an MFA recovery approval. It only closes a disputed case.
-- This migration depends on the intake and independent review migrations.
begin;
-- Earlier intake migration grants SELECT/INSERT only; allow service-role
-- status closure without granting arbitrary case modifications.
grant update (status,closed_at) on public.identity_mfa_recovery_requests to service_role;
create table if not exists public.identity_mfa_recovery_rejections (
  case_user_id uuid primary key references public.identity_mfa_recovery_requests(user_id) on delete cascade,
  rejected_by uuid not null references auth.users(id),
  negative_review_by uuid not null references auth.users(id),
  rejected_at timestamptz not null default now(),
  constraint identity_recovery_rejection_independent check (
    case_user_id <> rejected_by and rejected_by <> negative_review_by
      and case_user_id <> negative_review_by)
);
alter table public.identity_mfa_recovery_rejections enable row level security;
revoke all on public.identity_mfa_recovery_rejections from public, anon, authenticated;
grant select, insert on public.identity_mfa_recovery_rejections to service_role;

-- Only the owner may make the final rejection, on the strength of a DIFFERENT
-- currently privileged reviewer's insufficient-evidence record. No other
-- decision outcome is supported, and owner-claimant recovery remains external.
create or replace function public.identity_reject_mfa_recovery(
  p_actor uuid, p_session uuid, p_case uuid
) returns boolean language plpgsql security invoker set search_path='' as $reject$
declare v_case_role text;
declare v_negative_reviewer uuid;
declare v_current_case_role text;
begin
  if p_actor is null or p_session is null or p_case is null or p_actor=p_case then
    return false;
  end if;
  if not exists (
    select 1 from public.identity_global_roles
      where user_id=p_actor and role='owner'
  ) then return false; end if;
  if public.identity_session_active(p_actor,p_session) is distinct from true then
    return false;
  end if;

  -- Serialize close against concurrent review insertion by locking the case.
  select requested_role into v_case_role
    from public.identity_mfa_recovery_requests
    where user_id=p_case and status='pending' for update;
  if not found or v_case_role='owner' then return false; end if;
  select role into v_current_case_role
    from public.identity_global_roles where user_id=p_case;
  if v_current_case_role='owner' then return false; end if;

  select r.reviewer_id into v_negative_reviewer
    from public.identity_mfa_recovery_reviews r
    join public.identity_global_roles g on g.user_id=r.reviewer_id
    where r.case_user_id=p_case and r.review_outcome='insufficient_evidence'
      and r.reviewer_id<>p_actor and r.reviewer_id<>p_case
      and g.role in ('admin','owner')
    order by r.reviewed_at, r.reviewer_id
    limit 1;
  if v_negative_reviewer is null then return false; end if;

  insert into public.identity_mfa_recovery_rejections
    (case_user_id,rejected_by,negative_review_by)
    values(p_case,p_actor,v_negative_reviewer);
  update public.identity_mfa_recovery_requests
    set status='closed',closed_at=now()
    where user_id=p_case and status='pending';
  if not found then raise exception 'mfa_recovery_rejection_inconsistent'; end if;
  insert into public.identity_audit_log(user_id,action)
    values(p_actor,'mfa_recovery_rejected');
  return true;
end;
$reject$;
revoke all on function public.identity_reject_mfa_recovery(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.identity_reject_mfa_recovery(uuid,uuid,uuid)
  to service_role;
commit;
