-- Supabase Auth remains the sole session authority.
-- Backend-only RPCs; never expose session inventory to anonymous clients.
begin;
create or replace function public.identity_session_active(p_user uuid,p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_user
    and (s.not_after is null or s.not_after > now()));
$$;
create or replace function public.identity_list_sessions(p_user uuid,p_current uuid)
returns table(id uuid,created_at timestamptz,updated_at timestamptz,user_agent text,is_current boolean)
language sql stable security definer set search_path = '' as $$
  select s.id,s.created_at,s.updated_at,left(s.user_agent,512),s.id=p_current
  from auth.sessions s where s.user_id=p_user and (s.not_after is null or s.not_after > now())
  order by s.updated_at desc nulls last,s.id;
$$;
create or replace function public.identity_revoke_session(p_user uuid,p_current uuid,p_target uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare removed uuid;
begin
  if p_current=p_target or not public.identity_session_active(p_user,p_current) then return false; end if;
  delete from auth.sessions where user_id=p_user and id=p_target returning id into removed;
  return removed is not null;
end;
$$;
revoke all on function public.identity_session_active(uuid,uuid),public.identity_list_sessions(uuid,uuid),public.identity_revoke_session(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_session_active(uuid,uuid),public.identity_list_sessions(uuid,uuid),public.identity_revoke_session(uuid,uuid,uuid) to service_role;
commit;
