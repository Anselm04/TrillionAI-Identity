-- Forward-only versioned recovery cases: never changes MFA or access.
-- Depends on intake, reviews, rejection migrations (00001-00003).
-- Legacy tables remain read-only historical evidence. New writes use case_id.
begin;
create table public.identity_mfa_recovery_cases (
 case_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 case_version integer not null check (case_version between 1 and 2147483647),
 requested_role text not null check(requested_role in ('customer','admin','owner')),
 session_id uuid not null,
 status text not null check(status in ('pending','closed')),
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 constraint identity_versioned_case_status check (
   (status='pending' and closed_at is null) or (status='closed' and closed_at is not null)),
 unique(user_id,case_version)
);
create unique index identity_one_pending_recovery_case
 on public.identity_mfa_recovery_cases(user_id) where status='pending';
create index identity_recovery_case_queue on public.identity_mfa_recovery_cases(case_id) where status='pending';
alter table public.identity_mfa_recovery_cases enable row level security;
revoke all on public.identity_mfa_recovery_cases from public,anon,authenticated;
grant select,insert on public.identity_mfa_recovery_cases to service_role;
grant update(status,closed_at) on public.identity_mfa_recovery_cases to service_role;

create table public.identity_mfa_recovery_case_reviews (
 case_id uuid not null references public.identity_mfa_recovery_cases(case_id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete cascade,
 reviewer_session uuid not null,
 review_outcome text not null check(review_outcome in ('identity_evidence_sighted','insufficient_evidence')),
 evidence_method text not null check(evidence_method in ('in_person','verified_callback','verified_external_record')),
 evidence_reference_sha256 text not null check(evidence_reference_sha256 ~ '^[a-f0-9]{64}$'),
 reviewed_at timestamptz not null default now(),
 primary key(case_id,reviewer_id)
);
alter table public.identity_mfa_recovery_case_reviews enable row level security;
revoke all on public.identity_mfa_recovery_case_reviews from public,anon,authenticated;
grant select,insert on public.identity_mfa_recovery_case_reviews to service_role;

create table public.identity_mfa_recovery_case_rejections (
 case_id uuid primary key references public.identity_mfa_recovery_cases(case_id) on delete cascade,
 rejected_by uuid not null references auth.users(id),
 negative_review_by uuid not null references auth.users(id),
 rejected_at timestamptz not null default now(),
 check(rejected_by <> negative_review_by)
);
alter table public.identity_mfa_recovery_case_rejections enable row level security;
revoke all on public.identity_mfa_recovery_case_rejections from public,anon,authenticated;
grant select,insert on public.identity_mfa_recovery_case_rejections to service_role;

-- Preserve every original request, attestation and rejected decision in the
-- versioned model; historical originals are retained and never overwritten.
insert into public.identity_mfa_recovery_cases
 (user_id,case_version,requested_role,session_id,status,created_at,closed_at)
 select user_id,1,requested_role,session_id,status,created_at,closed_at
 from public.identity_mfa_recovery_requests;
insert into public.identity_mfa_recovery_case_reviews
 (case_id,reviewer_id,reviewer_session,review_outcome,evidence_method,evidence_reference_sha256,reviewed_at)
 select c.case_id,r.reviewer_id,r.reviewer_session,r.review_outcome,
        r.evidence_method,r.evidence_reference_sha256,r.reviewed_at
 from public.identity_mfa_recovery_reviews r
 join public.identity_mfa_recovery_cases c on c.user_id=r.case_user_id and c.case_version=1;
insert into public.identity_mfa_recovery_case_rejections
 (case_id,rejected_by,negative_review_by,rejected_at)
 select c.case_id,r.rejected_by,r.negative_review_by,r.rejected_at
 from public.identity_mfa_recovery_rejections r
 join public.identity_mfa_recovery_cases c on c.user_id=r.case_user_id and c.case_version=1;

-- Serialize the entire intake per auth.users record before checking the
-- active case and issuing a monotonically increasing version.
create or replace function public.identity_request_mfa_recovery(
 p_actor uuid,p_session uuid,p_role text
) returns boolean language plpgsql security invoker set search_path='' as $intake$
declare current_role text;
declare next_version integer;
begin
 if p_actor is null or p_session is null or p_role is null
    or p_role not in ('customer','admin','owner') then return false; end if;
 if public.identity_session_active(p_actor,p_session) is distinct from true then return false; end if;
 select role into current_role from public.identity_global_roles where user_id=p_actor;
 if coalesce(current_role,'customer')<>p_role then return false; end if;
 perform 1 from auth.users where id=p_actor for update;
 if not found then return false; end if;
 if exists(select 1 from public.identity_mfa_recovery_cases
     where user_id=p_actor and status='pending') then return true; end if;
 select coalesce(max(case_version),0)+1 into next_version
   from public.identity_mfa_recovery_cases where user_id=p_actor;
 if next_version>2147483647 then return false; end if;
 insert into public.identity_mfa_recovery_cases
   (user_id,case_version,requested_role,session_id,status)
 values(p_actor,next_version,p_role,p_session,'pending');
 insert into public.identity_audit_log(user_id,action)
 values(p_actor,'mfa_recovery_requested');
 return true;
end; $intake$;

create or replace function public.identity_record_mfa_recovery_review(
 p_actor uuid,p_session uuid,p_case uuid,p_outcome text,
 p_method text,p_evidence_sha256 text
) returns boolean language plpgsql security invoker set search_path='' as $review$
declare v_role text;
declare claimant uuid;
declare inserted_count integer;
begin
 if p_actor is null or p_session is null or p_case is null
    or p_outcome is null or p_outcome not in ('identity_evidence_sighted','insufficient_evidence')
    or p_method is null or p_method not in ('in_person','verified_callback','verified_external_record')
    or p_evidence_sha256 is null or p_evidence_sha256 !~ '^[a-f0-9]{64}$' then return false; end if;
 select role into v_role from public.identity_global_roles where user_id=p_actor;
 if v_role is null or v_role not in ('owner','admin') then return false; end if;
 if public.identity_session_active(p_actor,p_session) is distinct from true then return false; end if;
 select user_id into claimant from public.identity_mfa_recovery_cases
 where case_id=p_case and status='pending' for update;
 if not found or claimant=p_actor then return false; end if;
 insert into public.identity_mfa_recovery_case_reviews
  (case_id,reviewer_id,reviewer_session,review_outcome,evidence_method,evidence_reference_sha256)
 values(p_case,p_actor,p_session,p_outcome,p_method,p_evidence_sha256)
 on conflict (case_id,reviewer_id) do nothing;
 get diagnostics inserted_count=row_count;
 if inserted_count<>1 then return false; end if;
 insert into public.identity_audit_log(user_id,action)
 values(p_actor,'mfa_recovery_review_attested');
 return true;
end; $review$;

create or replace function public.identity_reject_mfa_recovery(
 p_actor uuid,p_session uuid,p_case uuid
) returns boolean language plpgsql security invoker set search_path='' as $reject$
declare claimant uuid;
declare claim_role text;
declare current_claim_role text;
declare v_negative_reviewer uuid;
begin
 if p_actor is null or p_session is null or p_case is null then return false; end if;
 if not exists(select 1 from public.identity_global_roles
   where user_id=p_actor and role='owner') then return false; end if;
 if public.identity_session_active(p_actor,p_session) is distinct from true then return false; end if;
 select user_id,requested_role into claimant,claim_role
 from public.identity_mfa_recovery_cases
 where case_id=p_case and status='pending' for update;
 if not found or claimant=p_actor or claim_role='owner' then return false; end if;
 select role into current_claim_role from public.identity_global_roles where user_id=claimant;
 if current_claim_role='owner' then return false; end if;
 select r.reviewer_id into v_negative_reviewer
 from public.identity_mfa_recovery_case_reviews r
 join public.identity_global_roles g on g.user_id=r.reviewer_id
 where r.case_id=p_case and r.review_outcome='insufficient_evidence'
   and r.reviewer_id<>p_actor and r.reviewer_id<>claimant
   and g.role in ('admin','owner')
 order by r.reviewed_at,r.reviewer_id limit 1;
 if v_negative_reviewer is null then return false; end if;
 insert into public.identity_mfa_recovery_case_rejections(case_id,rejected_by,negative_review_by)
 values(p_case,p_actor,v_negative_reviewer);
 update public.identity_mfa_recovery_cases set status='closed',closed_at=now()
 where case_id=p_case and status='pending';
 if not found then raise exception 'recovery_closure_inconsistent'; end if;
 insert into public.identity_audit_log(user_id,action)
 values(p_actor,'mfa_recovery_rejected');
 return true;
end; $reject$;

-- Prior RPC grants remain service_role only; assert the new functions
-- retain that boundary explicitly after replacement.
revoke all on function public.identity_request_mfa_recovery(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.identity_record_mfa_recovery_review(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.identity_reject_mfa_recovery(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_request_mfa_recovery(uuid,uuid,text) to service_role;
grant execute on function public.identity_record_mfa_recovery_review(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.identity_reject_mfa_recovery(uuid,uuid,uuid) to service_role;
commit;
