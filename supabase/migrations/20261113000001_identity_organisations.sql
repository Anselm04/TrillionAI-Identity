-- Tenant membership retained from the previous OIDC foundation, using
-- confirmed Supabase auth.users IDs rather than Keycloak subject strings.
create table if not exists public.identity_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);
create table if not exists public.identity_memberships (
  organisation_id uuid not null references public.identity_organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','staff','customer')),
  status text not null default 'invited' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  primary key (organisation_id,user_id)
);
create index if not exists identity_memberships_active_user_idx
  on public.identity_memberships(user_id) where status='active';
alter table public.identity_organisations enable row level security;
alter table public.identity_memberships enable row level security;
revoke all on public.identity_organisations,public.identity_memberships from anon,authenticated;
-- No client policies. Backend service role must filter by validated caller UID.

-- Atomic tenant creation with the authenticated caller as the initial owner.
-- Invoker privileges; only the trusted backend may execute the function.
grant select, insert, update, delete on public.identity_organisations, public.identity_memberships to service_role;
create or replace function public.identity_create_organisation(p_user_id uuid, p_name text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.identity_organisations(name) values (pg_catalog.btrim(p_name)) returning id into v_id;
  insert into public.identity_memberships(organisation_id,user_id,role,status)
    values (v_id,p_user_id,'owner','active');
  insert into public.identity_audit_log(user_id,action) values (p_user_id,'organisation_created');
  return v_id;
end;
$$;
revoke all on function public.identity_create_organisation(uuid,text) from public, anon, authenticated;
grant execute on function public.identity_create_organisation(uuid,text) to service_role;

-- Lock the organisation before checking permission or changing membership.
create or replace function public.identity_change_membership(
 p_actor uuid,p_org uuid,p_target uuid,p_role text,p_status text,p_remove boolean
) returns text language plpgsql security invoker set search_path='' as $$
declare actor_role text; target_role text; target_status text;
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return 'not_found'; end if;
 select role into actor_role from public.identity_memberships
 where organisation_id=p_org and user_id=p_actor and status='active';
 if actor_role is null or actor_role not in ('owner','admin') then return 'not_found'; end if;
 select role,status into target_role,target_status from public.identity_memberships
 where organisation_id=p_org and user_id=p_target;
 if not found then return 'not_found'; end if;
 if actor_role='admin' and (target_role in ('owner','admin') or
   (not p_remove and p_role in ('owner','admin'))) then return 'forbidden'; end if;
 if not p_remove and (p_role is null or p_role not in ('owner','admin','staff','customer')
  or p_status is null or p_status not in ('active','suspended')) then return 'invalid'; end if;
 if not p_remove and target_status='invited' then return 'invitation_pending'; end if;
 if p_remove then
  delete from public.identity_memberships where organisation_id=p_org and user_id=p_target;
 else
  update public.identity_memberships set role=p_role,status=p_status
    where organisation_id=p_org and user_id=p_target;
 end if;
 if not exists(select 1 from public.identity_memberships
  where organisation_id=p_org and role='owner' and status='active') then
   raise exception 'last_active_owner' using errcode='23514';
 end if;
 insert into public.identity_audit_log(user_id,action)
 values(p_actor,case when p_remove then 'membership_removed' else 'membership_updated' end);
 return 'ok';
end;
$$;
revoke all on function public.identity_change_membership(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.identity_change_membership(uuid,uuid,uuid,text,text,boolean) to service_role;
