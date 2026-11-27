\set ON_ERROR_STOP on
-- Disposable database only. Expected action supplied by the history runner.
select set_config('identity.ci_expected_fk', :'expected_fk', false);
begin;
do $test$
declare
 expected text:=current_setting('identity.ci_expected_fk');
 actual text;
 uid constant uuid:='40000000-0000-4000-8000-000000000001';
begin
 select confdeltype::text into strict actual from pg_constraint
 where conrelid='public.identity_stripe_customers'::regclass
 and confrelid='auth.users'::regclass and contype='f';
 if actual<>expected then raise exception 'expected FK action %, got %',expected,actual; end if;
 insert into auth.users(id) values(uid);
 insert into public.identity_stripe_customers(user_id,stripe_customer_id) values(uid,'cus_CIHistory');
 insert into public.identity_stripe_events(event_id,customer_id,subscription_id,event_created,status,live_mode)
 values('evt_CIHistory','cus_CIHistory','sub_CIHistory',1,'cancelled',false);
 if expected='r' then
  begin
   delete from auth.users where id=uid;
   raise exception 'restricted deletion unexpectedly succeeded';
  exception when foreign_key_violation then
   raise notice 'legacy restriction reproduced: SQLSTATE 23503';
  end;
  if not exists(select 1 from auth.users where id=uid) or not exists(select 1 from public.identity_stripe_customers where user_id=uid) then raise exception 'restriction failed to preserve records'; end if;
 elsif expected='c' then
  delete from auth.users where id=uid;
  if exists(select 1 from auth.users where id=uid) or exists(select 1 from public.identity_stripe_customers where user_id=uid) then raise exception 'cascade failed'; end if;
 else raise exception 'unexpected test action';
 end if;
 if not exists(select 1 from public.identity_stripe_events where event_id='evt_CIHistory') then raise exception 'billing receipt lost'; end if;
end; $test$;
rollback;
