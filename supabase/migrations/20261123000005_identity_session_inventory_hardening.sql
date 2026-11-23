-- Forward-only hardening of the service-role session inventory RPCs.
-- Preserve Supabase Auth as credential authority and its auth.sessions schema.
-- Expired sessions are not eligible authorizers even before background cleanup.
begin;
create or replace function public.identity_list_sessions(p_user uuid,p_current uuid)
returns table(id uuid,created_at timestamptz,updated_at timestamptz,current_session boolean)
language sql stable security definer set search_path=''
as $list$
 select s.id,s.created_at,s.updated_at,s.id=p_current
 from auth.sessions s
 where p_user is not null and p_current is not null
   and s.user_id=p_user
   and (s.not_after is null or s.not_after>now())
   and exists(
     select 1 from auth.sessions c
     where c.id=p_current and c.user_id=p_user
       and (c.not_after is null or c.not_after>now())
   )
 order by s.created_at desc,s.id
$list$;

create or replace function public.identity_revoke_session(p_user uuid,p_current uuid,p_target uuid)
returns boolean language plpgsql security definer set search_path=''
as $revoke$
begin
 if p_user is null or p_current is null or p_target is null or p_target=p_current then
   return false;
 end if;
 -- Lock the caller's CURRENT session before deletion to serialize this RPC
 -- with a concurrent deletion of that row. An expired caller cannot revoke.
 perform 1 from auth.sessions c
 where c.id=p_current and c.user_id=p_user
   and (c.not_after is null or c.not_after>now())
 for update;
 if not found then return false; end if;
 delete from auth.sessions s
 where s.id=p_target and s.user_id=p_user;
 return found;
end;
$revoke$;

create or replace function public.identity_session_active(p_user uuid,p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $active$
 select p_user is not null and p_session is not null and exists(
   select 1 from auth.sessions s
   where s.id=p_session and s.user_id=p_user
     and (s.not_after is null or s.not_after>now())
 )
$active$;

revoke all on function public.identity_list_sessions(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.identity_revoke_session(uuid,uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.identity_session_active(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.identity_list_sessions(uuid,uuid) to service_role;
grant execute on function public.identity_revoke_session(uuid,uuid,uuid) to service_role;
grant execute on function public.identity_session_active(uuid,uuid) to service_role;
commit;
