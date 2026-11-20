-- Identity's standalone service-credential registry; this does not issue OAuth tokens.
-- Secrets are random 256-bit strings. Only SHA-256 digests are persisted.
-- Callable exclusively by the backend service_role, never anon/authenticated.
create table public.identity_service_credentials (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.identity_organisations(id) on delete cascade,
 client_id uuid not null references public.identity_developer_clients(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 100),
 secret_digest text not null unique check (secret_digest ~ '^[0-9a-f]{64}$'),
 secret_hint text not null check (secret_hint ~ '^tai_sk_[0-9a-f]{8}$'),
 scopes text[] not null check (scopes = array['identity:service:read']::text[]),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 last_used_at timestamptz
);
alter table public.identity_service_credentials enable row level security;
revoke all on public.identity_service_credentials from public,anon,authenticated;
grant select,insert,update on public.identity_service_credentials to service_role;
create index identity_credentials_client_idx on public.identity_service_credentials(client_id,id);
create index identity_credentials_expiry_idx on public.identity_service_credentials(expires_at) where revoked_at is null;

create function public.identity_issue_service_credential(
 p_actor uuid,p_org uuid,p_client uuid,p_name text,p_digest text,p_hint text,p_scopes text[],p_expires timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $fn$
declare credential uuid;
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return null; end if;
 if not exists (
  select 1 from public.identity_memberships
  where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin')
 ) then return null; end if;
 if not exists (
  select 1 from public.identity_developer_clients
  where id=p_client and organisation_id=p_org and client_type='confidential' and revoked_at is null
 ) then return null; end if;
 if p_name is null or char_length(p_name) not between 1 and 100
    or p_digest !~ '^[0-9a-f]{64}$' or p_hint !~ '^tai_sk_[0-9a-f]{8}$'
    or p_scopes is distinct from array['identity:service:read']::text[]
    or p_expires is null or p_expires <= now() or p_expires > now()+interval '90 days 1 minute'
 then return null; end if;
 if (select count(*) from public.identity_service_credentials
     where client_id=p_client and revoked_at is null and expires_at>now())>=20
 then raise exception 'active_credential_limit' using errcode='23514'; end if;
 insert into public.identity_service_credentials
   (organisation_id,client_id,name,secret_digest,secret_hint,scopes,created_by,expires_at)
 values(p_org,p_client,p_name,p_digest,p_hint,p_scopes,p_actor,p_expires)
 returning id into credential;
 insert into public.identity_audit_log(user_id,action)
 values(p_actor,'service_credential_issued');
 return credential;
end;
$fn$;

create function public.identity_list_service_credentials(
 p_actor uuid,p_org uuid,p_client uuid,p_after uuid)
returns jsonb language sql stable security invoker set search_path='' as $fn$
 with allowed as (
  select 1 from public.identity_memberships
  where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin')
 ), page as (
  select k.id,k.name,k.secret_hint,k.scopes,k.created_at,k.expires_at,k.revoked_at,k.last_used_at
  from public.identity_service_credentials k
  where k.organisation_id=p_org and k.client_id=p_client
    and (p_after is null or k.id>p_after) and exists(select 1 from allowed)
  order by k.id limit 101
 ), visible as (select * from page order by id limit 100)
 select case when not exists(select 1 from allowed) then null
 else jsonb_build_object(
   'credentials',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from visible v),'[]'::jsonb),
   'next_cursor',case when (select count(*) from page)>100 then
      (select id from visible order by id desc limit 1) else null end)
 end;
$fn$;

create function public.identity_revoke_service_credential(
 p_actor uuid,p_org uuid,p_client uuid,p_credential uuid)
returns boolean language plpgsql security invoker set search_path='' as $fn$
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return false; end if;
 if not exists(select 1 from public.identity_memberships
   where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin')
 ) then return false; end if;
 update public.identity_service_credentials set revoked_at=now()
 where id=p_credential and client_id=p_client and organisation_id=p_org and revoked_at is null;
 if not found then return false; end if;
 insert into public.identity_audit_log(user_id,action) values(p_actor,'service_credential_revoked');
 return true;
end;
$fn$;

-- Read-time credential validity is checked atomically with tenant/client status.
-- This introspection returns only tenant/client/scopes; never the digest.
create function public.identity_introspect_service_credential(p_digest text)
returns jsonb language sql stable security invoker set search_path='' as $fn$
 select jsonb_build_object(
 'credential_id',k.id,'organisation_id',k.organisation_id,
 'client_id',k.client_id,'scopes',k.scopes,'expires_at',k.expires_at)
 from public.identity_service_credentials k
 join public.identity_developer_clients c on c.id=k.client_id
 where k.secret_digest=p_digest and k.revoked_at is null and k.expires_at>now()
   and c.revoked_at is null and c.client_type='confidential'
   and c.organisation_id=k.organisation_id
 limit 1;
$fn$;
revoke all on function public.identity_issue_service_credential(uuid,uuid,uuid,text,text,text,text[],timestamptz),
 public.identity_list_service_credentials(uuid,uuid,uuid,uuid),
 public.identity_revoke_service_credential(uuid,uuid,uuid,uuid),
 public.identity_introspect_service_credential(text)
 from public,anon,authenticated;
grant execute on function public.identity_issue_service_credential(uuid,uuid,uuid,text,text,text,text[],timestamptz),
 public.identity_list_service_credentials(uuid,uuid,uuid,uuid),
 public.identity_revoke_service_credential(uuid,uuid,uuid,uuid),
 public.identity_introspect_service_credential(text) to service_role;
