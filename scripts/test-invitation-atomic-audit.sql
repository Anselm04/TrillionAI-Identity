\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003'),('10000000-0000-4000-8000-000000000004');
insert into public.identity_organisations(id,name) values ('20000000-0000-4000-8000-000000000001','CI only');
insert into public.identity_memberships(organisation_id,user_id,role,status) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner','active'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','admin','active'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','staff','active');
create function public.ci_invite_audit_failure() returns trigger language plpgsql as $f$
begin
 if current_setting('identity.ci_fail_audit',true)=new.action then raise exception 'ci_audit_failure' using errcode='P0001'; end if;
 return new;
end; $f$;
create trigger ci_invite_audit_failure before insert on public.identity_audit_log for each row execute function public.ci_invite_audit_failure();
set local role service_role;
do $test$
declare
 owner_id constant uuid:='10000000-0000-4000-8000-000000000001';
 admin_id constant uuid:='10000000-0000-4000-8000-000000000002';
 staff_id constant uuid:='10000000-0000-4000-8000-000000000003';
 outsider constant uuid:='10000000-0000-4000-8000-000000000004';
 org constant uuid:='20000000-0000-4000-8000-000000000001';
 inv uuid;
begin
 if public.identity_issue_invitation(outsider,org,'ci@example.invalid','staff',repeat('a',64),now()+interval '1 day') is not null then raise exception 'outsider issued'; end if;
 if public.identity_issue_invitation(admin_id,org,'ci@example.invalid','admin',repeat('a',64),now()+interval '1 day') is not null then raise exception 'admin elevated'; end if;
 perform set_config('identity.ci_fail_audit','invitation_created',true);
 begin
  perform public.identity_issue_invitation(owner_id,org,'ci@example.invalid','admin',repeat('a',64),now()+interval '1 day');
  raise exception 'audit failure missing' using errcode='XX000';
 exception when raise_exception then
  if sqlerrm<>'ci_audit_failure' then raise; end if;
 end;
 if exists(select 1 from public.identity_invitations where organisation_id=org) then raise exception 'issue rollback failed'; end if;
 perform set_config('identity.ci_fail_audit','',true);
 inv:=public.identity_issue_invitation(owner_id,org,'ci@example.invalid','admin',repeat('a',64),now()+interval '1 day');
 if inv is null then raise exception 'issue failed'; end if;
 if (select count(*) from public.identity_audit_log where user_id=owner_id and action='invitation_created')<>1 then raise exception 'issue audit count'; end if;
 if public.identity_revoke_invitation(staff_id,org,inv) is distinct from false or public.identity_revoke_invitation(admin_id,org,inv) is distinct from false then raise exception 'unauthorized revoke'; end if;
 perform set_config('identity.ci_fail_audit','invitation_revoked',true);
 begin
  perform public.identity_revoke_invitation(owner_id,org,inv);
  raise exception 'audit failure missing' using errcode='XX000';
 exception when raise_exception then
  if sqlerrm<>'ci_audit_failure' then raise; end if;
 end;
 if exists(select 1 from public.identity_invitations where id=inv and revoked_at is not null) then raise exception 'revoke rollback failed'; end if;
 perform set_config('identity.ci_fail_audit','',true);
 if public.identity_revoke_invitation(owner_id,org,inv) is distinct from true then raise exception 'revoke failed'; end if;
 if public.identity_revoke_invitation(owner_id,org,inv) is distinct from false then raise exception 'duplicate revoke'; end if;
 if (select count(*) from public.identity_audit_log where action='invitation_revoked' and user_id=owner_id)<>1 then raise exception 'revoke audit count'; end if;
 if exists(select 1 from public.identity_audit_log where user_id in (admin_id,staff_id,outsider) and action in ('invitation_created','invitation_revoked')) then raise exception 'unauthorized audit'; end if;
 if has_function_privilege('anon','public.identity_issue_invitation(uuid,uuid,text,text,text,timestamptz)','execute') or has_function_privilege('authenticated','public.identity_issue_invitation(uuid,uuid,text,text,text,timestamptz)','execute') or has_function_privilege('anon','public.identity_revoke_invitation(uuid,uuid,uuid)','execute') or has_function_privilege('authenticated','public.identity_revoke_invitation(uuid,uuid,uuid)','execute') then raise exception 'unsafe RPC grants'; end if;
end; $test$;
reset role;
rollback;
