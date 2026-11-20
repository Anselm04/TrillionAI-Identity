-- Developer application registry; metadata only, not an authorization server.
create table public.identity_developer_clients (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.identity_organisations(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 100),
 client_type text not null check (client_type in ('public','confidential')),
 redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
alter table public.identity_developer_clients enable row level security;
revoke all on public.identity_developer_clients from public,anon,authenticated;
grant select,insert,update on public.identity_developer_clients to service_role;
create index identity_developer_clients_org_idx on public.identity_developer_clients(organisation_id,id);
create function public.identity_register_client(p_actor uuid,p_org uuid,p_name text,p_type text,p_redirects text[])
returns uuid language plpgsql security invoker set search_path='' as $fn$
declare result uuid;
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return null; end if;
 if not exists(select 1 from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin')) then return null; end if;
 insert into public.identity_developer_clients(organisation_id,name,client_type,redirect_uris)
 values(p_org,p_name,p_type,p_redirects) returning id into result;
 insert into public.identity_audit_log(user_id,action) values(p_actor,'developer_client_registered');
 return result;
end;
$fn$;
create function public.identity_list_clients(p_actor uuid,p_org uuid,p_after uuid)
returns jsonb language sql stable security invoker set search_path='' as $fn$
 with allowed as (select 1 from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin')),
 page as (select id,name,client_type,redirect_uris,created_at,revoked_at from public.identity_developer_clients where organisation_id=p_org and (p_after is null or id>p_after) and exists(select 1 from allowed) order by id limit 101),
 visible as (select * from page order by id limit 100)
 select case when not exists(select 1 from allowed) then null else jsonb_build_object('clients',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from visible v),'[]'::jsonb),'next_cursor',case when (select count(*) from page)>100 then (select id from visible order by id desc limit 1) else null end) end;
$fn$;
create function public.identity_revoke_client(p_actor uuid,p_org uuid,p_client uuid)
returns boolean language plpgsql security invoker set search_path='' as $fn$
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return false; end if;
 if not exists(select 1 from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin')) then return false; end if;
 update public.identity_developer_clients set revoked_at=now() where organisation_id=p_org and id=p_client and revoked_at is null;
 if not found then return false; end if;
 insert into public.identity_audit_log(user_id,action) values(p_actor,'developer_client_revoked');
 return true;
end;
$fn$;
revoke all on function public.identity_register_client(uuid,uuid,text,text,text[]),public.identity_list_clients(uuid,uuid,uuid),public.identity_revoke_client(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_register_client(uuid,uuid,text,text,text[]),public.identity_list_clients(uuid,uuid,uuid),public.identity_revoke_client(uuid,uuid,uuid) to service_role;
