-- Run only against an isolated test database after migrations.
begin;
do $$
declare
  u uuid := gen_random_uuid();
  v uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
begin
  insert into auth.users(id,email) values (u,u::text||'@example.invalid'),(v,v::text||'@example.invalid');
  insert into auth.sessions(id,user_id,created_at,updated_at) values
    (a,u,now(),now()),(b,u,now(),now()),(c,v,now(),now());
  if not public.identity_session_active(u,a) then raise exception 'active session rejected'; end if;
  if public.identity_session_active(u,c) then raise exception 'cross-user session accepted'; end if;
  if (select count(*) from public.identity_list_sessions(u,a)) <> 2 then raise exception 'inventory scope incorrect'; end if;
  if (select count(*) from public.identity_list_sessions(u,c)) <> 0 then raise exception 'invalid caller accepted'; end if;
  if public.identity_revoke_session(u,a,c) then raise exception 'cross-user revocation accepted'; end if;
  if public.identity_revoke_session(u,a,a) then raise exception 'current session revoked'; end if;
  if public.identity_revoke_session(u,null,b) then raise exception 'null caller accepted'; end if;
  if not public.identity_revoke_session(u,a,b) then raise exception 'target revocation failed'; end if;
  if public.identity_session_active(u,b) then raise exception 'revoked session still active'; end if;
  if not public.identity_session_active(v,c) then raise exception 'unrelated session affected'; end if;
  if public.identity_revoke_session(u,a,b) then raise exception 'deleted target reported as active'; end if;
  if has_function_privilege('authenticated','public.identity_revoke_session(uuid,uuid,uuid)','EXECUTE') then raise exception 'client can call privileged revocation'; end if;
  if has_function_privilege('anon','public.identity_list_sessions(uuid,uuid)','EXECUTE') then raise exception 'anonymous inventory access'; end if;
end $$;
rollback;
