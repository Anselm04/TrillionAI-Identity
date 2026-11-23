-- Forward-only: revoked sessions and their audit event commit or roll back together.
-- Preserve the existing service-role-only RPC signature and Supabase Auth authority.
begin;
create or replace function public.identity_revoke_session(p_user uuid,p_current uuid,p_target uuid)
returns boolean language plpgsql security definer set search_path=''
as $revoke$
begin
 if p_user is null or p_current is null or p_target is null or p_target=p_current then
   return false;
 end if;
 -- Ensure caller's own currently valid session cannot be concurrently removed
 -- before completing a revocation against another session.
 perform 1 from auth.sessions c
 where c.id=p_current and c.user_id=p_user
   and (c.not_after is null or c.not_after>now())
 for update;
 if not found then return false; end if;
 delete from auth.sessions s where s.id=p_target and s.user_id=p_user;
 if not found then return false; end if;
 -- If audit storage is unavailable, this exception rolls back the deletion.
 insert into public.identity_audit_log(user_id,action)
 values(p_user,'session_revoked');
 return true;
end;
$revoke$;
revoke all on function public.identity_revoke_session(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.identity_revoke_session(uuid,uuid,uuid) to service_role;
commit;
