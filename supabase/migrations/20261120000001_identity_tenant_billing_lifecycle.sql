-- Consolidated Identity tenant, billing and account ownership migration.
-- Apply after identity core and organisation migrations.
begin;
-- Installation source for the next CLI-generated migration. Apply only to Identity.

create table if not exists public.identity_invitations (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.identity_organisations(id) on delete cascade,
 recipient_email text not null check (char_length(recipient_email) between 3 and 254),
 role text not null check (role in ('admin','staff','customer')),
 token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
 invited_by uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 accepted_at timestamptz,
 revoked_at timestamptz
);
alter table public.identity_invitations enable row level security;
revoke all on public.identity_invitations from public,anon,authenticated;
grant select,insert,update,delete on public.identity_invitations to service_role;
create index if not exists identity_invites_org_idx on public.identity_invitations(organisation_id,created_at);
create or replace function public.identity_issue_invitation(p_actor uuid,p_org uuid,p_email text,p_role text,p_digest text,p_expires timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $invite$
declare actor_role text; result uuid;
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return null; end if;
 select role into actor_role from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active';
 if actor_role is null or actor_role not in ('owner','admin') or p_role is null or p_role not in ('admin','staff','customer') or (actor_role='admin' and p_role='admin') then return null; end if;
 if p_expires is null or p_expires<=now() or p_expires>now()+interval '7 days 1 minute' then return null; end if;
 insert into public.identity_invitations(organisation_id,recipient_email,role,token_digest,invited_by,expires_at)
 values(p_org,lower(trim(p_email)),p_role,p_digest,p_actor,p_expires) returning id into result;
 return result;
end;
$invite$;
revoke all on function public.identity_issue_invitation(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.identity_issue_invitation(uuid,uuid,text,text,text,timestamptz) to service_role;
create or replace function public.identity_accept_invitation(p_actor uuid,p_email text,p_digest text)
returns uuid language plpgsql security invoker set search_path='' as $invite$
declare inv public.identity_invitations%rowtype; issuer_role text; org uuid;
begin
 select organisation_id into org from public.identity_invitations where token_digest=p_digest;
 if not found then return null; end if;
 perform 1 from public.identity_organisations where id=org for update;
 select * into inv from public.identity_invitations where token_digest=p_digest for update;
 if not found or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() or p_email is null or inv.recipient_email<>lower(trim(p_email)) then return null; end if;
 select role into issuer_role from public.identity_memberships where organisation_id=org and user_id=inv.invited_by and status='active';
 if issuer_role is null or issuer_role not in ('owner','admin') or (issuer_role='admin' and inv.role='admin') then return null; end if;
 insert into public.identity_memberships(organisation_id,user_id,role,status) values(org,p_actor,inv.role,'active') on conflict do nothing;
 if not found then return null; end if;
 update public.identity_invitations set accepted_at=now() where id=inv.id;
 insert into public.identity_audit_log(user_id,action) values(p_actor,'invitation_accepted');
 return org;
end;
$invite$;
revoke all on function public.identity_accept_invitation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.identity_accept_invitation(uuid,text,text) to service_role;
create or replace function public.identity_revoke_invitation(p_actor uuid,p_org uuid,p_invite uuid)
returns boolean language plpgsql security invoker set search_path='' as $invite$
declare actor_role text;
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return false; end if;
 select role into actor_role from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active';
 if actor_role is null or actor_role not in ('owner','admin') then return false; end if;
 update public.identity_invitations set revoked_at=now() where id=p_invite and organisation_id=p_org and accepted_at is null and revoked_at is null and (actor_role='owner' or role<>'admin');
 return found;
end;
$invite$;
revoke all on function public.identity_revoke_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_revoke_invitation(uuid,uuid,uuid) to service_role;
-- Return at most 100 records, plus a cursor when there are further records.
-- Never return invitation token digests.
create or replace function public.identity_list_members(p_actor uuid,p_org uuid,p_after uuid)
returns jsonb language sql stable security invoker set search_path='' as $read$
 with allowed as (
  select 1 from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin','staff')
 ), page as (
  select m.user_id,m.role,m.status,m.created_at from public.identity_memberships m
  where m.organisation_id=p_org and (p_after is null or m.user_id>p_after) and exists(select 1 from allowed)
  order by m.user_id limit 101
 ), visible as (select * from page order by user_id limit 100)
 select case when not exists(select 1 from allowed) then jsonb_build_object('denied',true)
 else jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(v) order by v.user_id) from visible v),'[]'::jsonb),
 'next_cursor',case when (select count(*) from page)>100 then (select user_id from visible order by user_id desc limit 1) else null end) end;
$read$;
revoke all on function public.identity_list_members(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_list_members(uuid,uuid,uuid) to service_role;
create or replace function public.identity_list_invitations(p_actor uuid,p_org uuid,p_after uuid)
returns jsonb language sql stable security invoker set search_path='' as $read$
 with allowed as (
  select role from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active' and role in ('owner','admin')
 ), page as (
  select i.id,i.recipient_email,i.role,i.created_at,i.expires_at,i.accepted_at,i.revoked_at
  from public.identity_invitations i where i.organisation_id=p_org and (p_after is null or i.id>p_after)
  and exists(select 1 from allowed a where a.role='owner' or i.role<>'admin')
  order by i.id limit 101
 ), visible as (select * from page order by id limit 100)
 select case when not exists(select 1 from allowed) then jsonb_build_object('denied',true)
 else jsonb_build_object('invitations',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from visible v),'[]'::jsonb),
 'next_cursor',case when (select count(*) from page)>100 then (select id from visible order by id desc limit 1) else null end) end;
$read$;
revoke all on function public.identity_list_invitations(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_list_invitations(uuid,uuid,uuid) to service_role;


-- Installation source; apply only to the Identity database.

create table if not exists public.identity_stripe_customers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now()
);
alter table public.identity_stripe_customers enable row level security;
revoke all on public.identity_stripe_customers from public,anon,authenticated;
grant select,insert,update,delete on public.identity_stripe_customers to service_role;
-- Durable idempotent event receipt; no entitlement is granted from an event payload.
create table if not exists public.identity_stripe_events (
 event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]+$'),
 customer_id text not null check (customer_id ~ '^cus_[A-Za-z0-9]+$'),
 subscription_id text not null check (subscription_id ~ '^sub_[A-Za-z0-9]+$'),
 event_created bigint not null,
 status text not null,
 live_mode boolean not null,
 received_at timestamptz not null default now()
);
alter table public.identity_stripe_events enable row level security;
revoke all on public.identity_stripe_events from public,anon,authenticated;
grant select,insert on public.identity_stripe_events to service_role;
create index if not exists identity_stripe_events_customer_idx on public.identity_stripe_events(customer_id,event_created desc);
-- Atomic export of Identity-owned private billing metadata, never credentials.
create or replace function public.identity_export_billing(p_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $export$
 select jsonb_build_object('stripe_customer_id',c.stripe_customer_id,
 'events',coalesce((select jsonb_agg(jsonb_build_object('subscription_id',e.subscription_id,'status',e.status,'event_created',e.event_created) order by e.event_created) from public.identity_stripe_events e where e.customer_id=c.stripe_customer_id),'[]'::jsonb))
 from public.identity_stripe_customers c where c.user_id=p_user;
$export$;
revoke all on function public.identity_export_billing(uuid) from public,anon,authenticated;
grant execute on function public.identity_export_billing(uuid) to service_role;
-- Remove the customer association only through the final auth.users deletion cascade.
-- Event receipts remain pseudonymous billing records for deduplication/accounting.


-- Protect tenant ownership across all account and membership deletion paths.

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
