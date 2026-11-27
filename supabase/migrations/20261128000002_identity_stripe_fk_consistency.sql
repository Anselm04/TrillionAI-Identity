-- F-08: converge the two historical installation paths without deleting data.
-- Apply only via approved Identity migration workflow; never run on a live target from CI.
begin;
set local lock_timeout = '5s';
lock table public.identity_stripe_customers in access exclusive mode;
do $migration$
declare
 fk record;
 user_col smallint;
 target_col smallint;
begin
 select attnum into strict user_col from pg_attribute
 where attrelid='public.identity_stripe_customers'::regclass and attname='user_id' and not attisdropped;
 select attnum into strict target_col from pg_attribute
 where attrelid='auth.users'::regclass and attname='id' and not attisdropped;
 select conname,confdeltype,confupdtype,convalidated,condeferrable,confmatchtype
 into strict fk from pg_constraint
 where conrelid='public.identity_stripe_customers'::regclass
 and confrelid='auth.users'::regclass and contype='f'
 and conkey=array[user_col] and confkey=array[target_col];
 if not fk.convalidated or fk.condeferrable or fk.confupdtype<>'a' or fk.confmatchtype<>'s' then
  raise exception 'unexpected Stripe customer FK properties';
 end if;
 if fk.confdeltype='r' then
  execute format('alter table public.identity_stripe_customers drop constraint %I',fk.conname);
  execute format('alter table public.identity_stripe_customers add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',fk.conname);
 elsif fk.confdeltype<>'c' then
  raise exception 'unexpected Stripe customer FK delete action';
 end if;
end; $migration$;
commit;
