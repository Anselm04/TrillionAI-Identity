-- Protect tenant ownership across all account and membership deletion paths.
begin;
create or replace function public.identity_guard_last_owner()
returns trigger language plpgsql security invoker set search_path='' as $guard$
begin
 if old.role<>'owner' or old.status<>'active' then
  if tg_op='UPDATE' then return new; end if;
  return old;
 end if;
 if tg_op='UPDATE' then
  if new.role='owner' and new.status='active' and new.organisation_id=old.organisation_id and new.user_id=old.user_id then return new; end if;
 end if;
 perform 1 from public.identity_organisations where id=old.organisation_id for update;
 if not found then
  if tg_op='UPDATE' then return new; end if;
  return old;
 end if;
 if not exists(select 1 from public.identity_memberships where organisation_id=old.organisation_id and user_id<>old.user_id and role='owner' and status='active') then
  raise exception 'last_active_owner' using errcode='23514';
 end if;
 if tg_op='UPDATE' then return new; end if;
 return old;
end;
$guard$;
revoke all on function public.identity_guard_last_owner() from public,anon,authenticated;
-- The trigger executes for the invoker, including the provider's account-deletion role.
drop trigger if exists identity_guard_last_owner on public.identity_memberships;
create trigger identity_guard_last_owner before delete or update on public.identity_memberships
for each row execute function public.identity_guard_last_owner();
create or replace function public.identity_deletion_conflicts(p_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $check$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.id),'[]'::jsonb)
 from public.identity_organisations o join public.identity_memberships m on m.organisation_id=o.id
 where m.user_id=p_user and m.role='owner' and m.status='active'
 and not exists(select 1 from public.identity_memberships other where other.organisation_id=o.id and other.user_id<>p_user and other.role='owner' and other.status='active');
$check$;
revoke all on function public.identity_deletion_conflicts(uuid) from public,anon,authenticated;
grant execute on function public.identity_deletion_conflicts(uuid) to service_role;
commit;
