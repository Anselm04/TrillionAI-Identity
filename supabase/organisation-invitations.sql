-- Installation source for the next CLI-generated migration. Apply only to Identity.
begin;
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
commit;
