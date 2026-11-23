\set ON_ERROR_STOP on
-- Run after previous session inventory fixture, which leaves one active owner session.
-- Confirm success logs exactly once and failed audit writes roll back deletion.
insert into auth.sessions(id,user_id) values
 ('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
set role service_role;
do $test$
declare
 uid constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 caller constant uuid:='11111111-1111-4111-8111-111111111111';
 target constant uuid:='88888888-8888-4888-8888-888888888888';
 before_count bigint;
begin
 select count(*) into before_count from public.identity_audit_log
 where user_id=uid and action='session_revoked';
 if public.identity_revoke_session(uid,caller,target) is distinct from true then
   raise exception 'session revoke failed'; end if;
 if public.identity_session_active(uid,target) is distinct from false then
   raise exception 'revoked session remains active'; end if;
 if (select count(*) from public.identity_audit_log
     where user_id=uid and action='session_revoked')<>before_count+1 then
   raise exception 'missing or duplicated session revoke audit'; end if;
 if public.identity_revoke_session(uid,caller,target) is distinct from false then
   raise exception 'second revoke should be idempotent false'; end if;
 if (select count(*) from public.identity_audit_log
     where user_id=uid and action='session_revoked')<>before_count+1 then
   raise exception 'duplicate revoke wrote an audit event'; end if;
end;
$test$;
reset role;

-- A trigger simulates an audit storage write failure. Its exception must
-- prevent deletion of the session; no data or privileges are leaked.
create function public.identity_ci_block_revoke_audit() returns trigger
language plpgsql as $audit$
begin
 if new.action='session_revoked' then raise exception 'simulated audit failure'; end if;
 return new;
end; $audit$;
create trigger identity_ci_block_revoke_audit
before insert on public.identity_audit_log
for each row execute function public.identity_ci_block_revoke_audit();

set role service_role;
do $test$
declare
 uid constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 caller constant uuid:='11111111-1111-4111-8111-111111111111';
 target constant uuid:='99999999-9999-4999-8999-999999999999';
failed boolean:=false;
begin
 begin
   perform public.identity_revoke_session(uid,caller,target);
 exception when others then failed:=true;
 end;
 if not failed then raise exception 'audit write failure was swallowed'; end if;
 if public.identity_session_active(uid,target) is distinct from true then
   raise exception 'session deleted even though audit failed'; end if;
 if has_function_privilege('authenticated',
     'public.identity_revoke_session(uuid,uuid,uuid)','execute')
    or has_function_privilege('anon',
     'public.identity_revoke_session(uuid,uuid,uuid)','execute') then
   raise exception 'unsafe direct RPC execute grants'; end if;
 raise notice 'PASS: revoked session audit atomicity and fail-closed rollback';
end;
$test$;
reset role;
drop trigger identity_ci_block_revoke_audit on public.identity_audit_log;
drop function public.identity_ci_block_revoke_audit();
