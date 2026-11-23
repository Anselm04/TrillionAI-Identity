\set ON_ERROR_STOP on
-- The disposable recovery bootstrap creates minimal auth.sessions schema.
alter table auth.sessions add column created_at timestamptz not null default now();
alter table auth.sessions add column updated_at timestamptz not null default now();
insert into auth.sessions(id,user_id,not_after) values
('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),
('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '1 hour'),
('66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null),
('77777777-7777-4777-8777-777777777777','cccccccc-cccc-4ccc-8ccc-cccccccccccc',null);
-- Set a previously valid session to expired without physically deleting it.
update auth.sessions set not_after=now()-interval '1 hour'
where id='33333333-3333-4333-8333-333333333333';

set role service_role;
do $test$
declare
 owner_id constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 active_id constant uuid:='11111111-1111-4111-8111-111111111111';
 second_id constant uuid:='44444444-4444-4444-8444-444444444444';
 expired_id constant uuid:='55555555-5555-4555-8555-555555555555';
 alien_id constant uuid:='66666666-6666-4666-8666-666666666666';
 admin_id constant uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 admin_session constant uuid:='22222222-2222-4222-8222-222222222222';
 exp_current constant uuid:='33333333-3333-4333-8333-333333333333';
 counter integer;
begin
 if public.identity_session_active(owner_id,active_id) is distinct from true then
 raise exception 'active session rejected'; end if;
 if public.identity_session_active(owner_id,expired_id) is distinct from false
   or public.identity_session_active(owner_id,alien_id) is distinct from false
   or public.identity_session_active(null,active_id) is distinct from false then
 raise exception 'expired, alien or null session accepted'; end if;
 select count(*) into counter from public.identity_list_sessions(owner_id,active_id);
 if counter<>2 then raise exception 'list included expired or wrong-user sessions: %',counter; end if;
 select count(*) into counter from public.identity_list_sessions(owner_id,expired_id);
 if counter<>0 then raise exception 'expired caller listed other devices'; end if;
 select count(*) into counter from public.identity_list_sessions(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',exp_current);
 if counter<>0 then raise exception 'expired claimant session listed devices'; end if;
 if public.identity_revoke_session(owner_id,expired_id,second_id) is distinct from false
 then raise exception 'expired caller revoked a session'; end if;
 if public.identity_revoke_session(owner_id,active_id,alien_id) is distinct from false
 then raise exception 'cross-account session revoked'; end if;
 if public.identity_revoke_session(owner_id,active_id,active_id) is distinct from false
 then raise exception 'caller revoked their own current session'; end if;
 if public.identity_revoke_session(owner_id,active_id,second_id) is distinct from true
 then raise exception 'valid target session was not revoked'; end if;
 if public.identity_session_active(owner_id,second_id) is distinct from false
 then raise exception 'revoked session still considered active'; end if;
 if public.identity_revoke_session(owner_id,active_id,second_id) is distinct from false
 then raise exception 'duplicate session deletion succeeded'; end if;
 if public.identity_session_active(admin_id,admin_session) is distinct from true
 then raise exception 'unrelated admin session affected'; end if;
 if has_function_privilege('authenticated',
   'public.identity_revoke_session(uuid,uuid,uuid)','execute') or
   has_function_privilege('anon',
   'public.identity_session_active(uuid,uuid)','execute') then
 raise exception 'privileged RPC exposed to untrusted user'; end if;
 raise notice 'PASS: active/expired sessions, cross-account denial, revocation and RPC privileges';
end;
$test$;
reset role;
