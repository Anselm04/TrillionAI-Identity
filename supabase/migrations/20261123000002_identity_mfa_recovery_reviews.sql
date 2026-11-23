-- Append-only MFA recovery review *attestations*. Never authorizes factor reset.
-- Keep independent reviewer checks inside PostgreSQL as well as the API.
begin;
create table if not exists public.identity_mfa_recovery_reviews (
  case_user_id uuid not null references public.identity_mfa_recovery_requests(user_id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewer_session uuid not null,
  review_outcome text not null check (review_outcome in ('identity_evidence_sighted','insufficient_evidence')),
  evidence_method text not null check (evidence_method in ('in_person','verified_callback','verified_external_record')),
  evidence_reference_sha256 text not null check (evidence_reference_sha256 ~ '^[a-f0-9]{64}$'),
  reviewed_at timestamptz not null default now(),
  primary key (case_user_id, reviewer_id),
  constraint identity_recovery_no_self_review check (case_user_id <> reviewer_id)
);
alter table public.identity_mfa_recovery_reviews enable row level security;
revoke all on public.identity_mfa_recovery_reviews from public, anon, authenticated;
grant select, insert on public.identity_mfa_recovery_reviews to service_role;

create or replace function public.identity_record_mfa_recovery_review(
  p_actor uuid, p_session uuid, p_case uuid, p_outcome text,
  p_method text, p_evidence_sha256 text
) returns boolean
language plpgsql security invoker set search_path = '' as $review$
declare v_role text;
declare v_inserted integer;
begin
  if p_actor is null or p_session is null or p_case is null or p_actor = p_case
     or p_outcome is null or p_outcome not in ('identity_evidence_sighted','insufficient_evidence')
     or p_method is null or p_method not in ('in_person','verified_callback','verified_external_record')
     or p_evidence_sha256 is null or p_evidence_sha256 !~ '^[a-f0-9]{64}$' then
    return false;
  end if;
  select role into v_role from public.identity_global_roles where user_id = p_actor;
  if v_role is null or v_role not in ('owner','admin') then return false; end if;
  if public.identity_session_active(p_actor, p_session) is distinct from true then return false; end if;

  -- Lock the case: a review must be linked to a currently pending request.
  perform 1 from public.identity_mfa_recovery_requests
    where user_id=p_case and status='pending' for update;
  if not found then return false; end if;

  insert into public.identity_mfa_recovery_reviews
    (case_user_id,reviewer_id,reviewer_session,review_outcome,evidence_method,evidence_reference_sha256)
    values(p_case,p_actor,p_session,p_outcome,p_method,p_evidence_sha256)
    on conflict (case_user_id,reviewer_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted <> 1 then return false; end if;
  insert into public.identity_audit_log(user_id,action)
    values(p_actor,'mfa_recovery_review_attested');
  return true;
end;
$review$;
revoke all on function public.identity_record_mfa_recovery_review(uuid,uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.identity_record_mfa_recovery_review(uuid,uuid,uuid,text,text,text)
  to service_role;
commit;
