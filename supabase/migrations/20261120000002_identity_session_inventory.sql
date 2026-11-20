-- Identity session inventory migration; apply after existing Identity migrations.
-- Only the backend service role may call these functions.
begin;
create or replace function public.identity_list_sessions(p_user uuid, p_current uuid)
returns table(id uuid, created_at timestamptz, updated_at timestamptz, current_session boolean)
language sql stable security invoker set search_path = ''
as $$
 select s.id, s.created_at, s.updated_at, s.id = p_current
 from auth.sessions s
 where s.user_id = p_user
 and exists (select 1 from auth.sessions c where c.id = p_current and c.user_id = p_user)
 order by s.created_at desc, s.id;
$$;
revoke all on function public.identity_list_sessions(uuid,uuid) from public, anon, authenticated;
grant execute on function public.identity_list_sessions(uuid,uuid) to service_role;
-- Definer is necessary because the service role does not normally have direct access to auth.sessions.
alter function public.identity_list_sessions(uuid,uuid) security definer;
create or replace function public.identity_revoke_session(p_user uuid, p_current uuid, p_target uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
 if p_target = p_current then return false; end if;
 if not exists (select 1 from auth.sessions c where c.id = p_current and c.user_id = p_user) then return false; end if;
 delete from auth.sessions where id = p_target and user_id = p_user;
 return found;
end;
$$;
revoke all on function public.identity_revoke_session(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.identity_revoke_session(uuid,uuid,uuid) to service_role;
create or replace function public.identity_session_active(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = ''
as $session$ select exists(select 1 from auth.sessions where id = p_session and user_id = p_user and (not_after is null or not_after > now())); $session$;
revoke all on function public.identity_session_active(uuid,uuid) from public, anon, authenticated;
grant execute on function public.identity_session_active(uuid,uuid) to service_role;
commit;
