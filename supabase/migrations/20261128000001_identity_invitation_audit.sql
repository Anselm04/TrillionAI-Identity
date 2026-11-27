-- Forward-only: preserve existing event names and make invitation changes atomic with audit.
begin;
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
 insert into public.identity_audit_log(user_id,action) values(p_actor,'invitation_created');
 return result;
end;
$invite$;
revoke all on function public.identity_issue_invitation(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.identity_issue_invitation(uuid,uuid,text,text,text,timestamptz) to service_role;
create or replace function public.identity_revoke_invitation(p_actor uuid,p_org uuid,p_invite uuid)
returns boolean language plpgsql security invoker set search_path='' as $invite$
declare actor_role text;
begin
 perform 1 from public.identity_organisations where id=p_org for update;
 if not found then return false; end if;
 select role into actor_role from public.identity_memberships where organisation_id=p_org and user_id=p_actor and status='active';
 if actor_role is null or actor_role not in ('owner','admin') then return false; end if;
 update public.identity_invitations set revoked_at=now() where id=p_invite and organisation_id=p_org and accepted_at is null and revoked_at is null and (actor_role='owner' or role<>'admin');
 if not found then return false; end if;
 insert into public.identity_audit_log(user_id,action) values(p_actor,'invitation_revoked');
 return true;
end;
$invite$;
revoke all on function public.identity_revoke_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.identity_revoke_invitation(uuid,uuid,uuid) to service_role;
commit;
