\set ON_ERROR_STOP on
set role service_role;
do $proof$
declare
 claimant constant uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 owner_id constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 owner_session constant uuid := '11111111-1111-4111-8111-111111111111';
 admin_id constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 admin_session constant uuid := '22222222-2222-4222-8222-222222222222';
 user_session constant uuid := '33333333-3333-4333-8333-333333333333';
 original_case uuid; new_case uuid; third_case uuid;
begin
  select case_id into original_case from public.identity_mfa_recovery_cases
   where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and case_version=1;
 if original_case is null then raise exception 'legacy case was lost'; end if;
 if (select count(*) from public.identity_mfa_recovery_case_reviews
    where case_id=original_case)<>1 then raise exception 'legacy review was lost'; end if;
 if public.identity_request_mfa_recovery(claimant,user_session,'customer') is distinct from true
    then raise exception 'pending replay failed'; end if;
 if (select count(*) from public.identity_mfa_recovery_cases
    where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>1 then
    raise exception 'repeat intake created duplicate case'; end if;
 if public.identity_reject_mfa_recovery(owner_id,owner_session,original_case)
    is distinct from true then raise exception 'legacy case rejection failed'; end if;
 if public.identity_reject_mfa_recovery(owner_id,owner_session,original_case)
    is distinct from false then raise exception 'rejection was not single use'; end if;
 if public.identity_request_mfa_recovery(claimant,user_session,'customer')
    is distinct from true then raise exception 'reopen request failed'; end if;
 select case_id into new_case from public.identity_mfa_recovery_cases
    where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and case_version=2;
 if new_case is null or new_case=original_case then
    raise exception 'second case was not independent'; end if;
 if (select count(*) from public.identity_mfa_recovery_case_reviews
    where case_id=new_case)<>0 then raise exception 'old review leaked to new case'; end if;
 if (select count(*) from public.identity_mfa_recovery_case_rejections
    where case_id=new_case)<>0 then raise exception 'old rejection leaked to new case'; end if;
 if public.identity_reject_mfa_recovery(owner_id,owner_session,new_case)
    is distinct from false then raise exception 'old negative review enabled new rejection'; end if;
 if public.identity_record_mfa_recovery_review(admin_id,admin_session,new_case,
    'insufficient_evidence','in_person',repeat('b',64)) is distinct from true then
    raise exception 'new case review failed'; end if;
 if public.identity_record_mfa_recovery_review(admin_id,admin_session,new_case,
    'insufficient_evidence','in_person',repeat('b',64)) is distinct from false then
    raise exception 'new case review duplicated'; end if;
 if public.identity_reject_mfa_recovery(owner_id,owner_session,new_case)
    is distinct from true then raise exception 'new case rejection failed'; end if;
 if public.identity_request_mfa_recovery(claimant,user_session,'customer')
    is distinct from true then raise exception 'third version request failed'; end if;
 select case_id into third_case from public.identity_mfa_recovery_cases
    where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and case_version=3;
 if third_case is null then raise exception 'third version missing'; end if;
 if (select count(*) from public.identity_mfa_recovery_case_reviews)<>2
    or (select count(*) from public.identity_mfa_recovery_case_rejections)<>2 then
    raise exception 'historical evidence was modified'; end if;
 if (select count(*) from public.identity_mfa_recovery_cases where status='pending')<>1
    then raise exception 'more than one pending case'; end if;
 if (select count(*) from public.identity_mfa_recovery_cases
    where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and status='closed')<>2 then
    raise exception 'closed cases were not preserved'; end if;
 if has_table_privilege('authenticated','public.identity_mfa_recovery_cases','select')
    or has_table_privilege('anon','public.identity_mfa_recovery_cases','select')
    then raise exception 'case contents leaked via table grants'; end if;
 if public.identity_request_mfa_recovery(claimant,user_session,'owner') is distinct from false
    then raise exception 'client-supplied privilege could spoof owner'; end if;
 raise notice 'PASS: versioned recovery migration preserves all evidence and isolates incidents';
end;
$proof$;
reset role;
