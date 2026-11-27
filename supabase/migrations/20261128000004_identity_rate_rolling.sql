-- Exact rolling quota, bounded to 20 admitted timestamps per digest.
begin;
create table public.identity_rate_rolling(
 key_digest text primary key check(key_digest ~ '^[0-9a-f]{64}$'),
 admitted_at timestamptz[] not null default '{}' check(cardinality(admitted_at)<=20),
 expires_at timestamptz not null
);
create index identity_rate_rolling_expiry on public.identity_rate_rolling(expires_at);
alter table public.identity_rate_rolling enable row level security;
revoke all on public.identity_rate_rolling from public,anon,authenticated;
grant select,insert,update,delete on public.identity_rate_rolling to service_role;
create function public.identity_rate_rolling_hit(p_key text)
returns jsonb language plpgsql security invoker set search_path='' as $rate$
declare stamp timestamptz; retained timestamptz[]; n integer; permitted boolean;
begin
 if p_key is null or p_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_rate_key'; end if;
 -- Serialize each digest, including cleanup races; acquire row before reading clock.
 loop
  insert into public.identity_rate_rolling(key_digest,expires_at)
  values(p_key,clock_timestamp()+interval '15 minutes') on conflict do nothing;
  select admitted_at into retained from public.identity_rate_rolling where key_digest=p_key for update;
  exit when found;
 end loop;
 stamp:=clock_timestamp();
 select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into retained
 from unnest(retained) t where t>stamp-interval '15 minutes';
 n:=cardinality(retained);
 permitted:=n<20;
 if permitted then retained:=array_append(retained,stamp); n:=n+1; end if;
 update public.identity_rate_rolling set admitted_at=retained,
 expires_at=retained[n]+interval '15 minutes' where key_digest=p_key;
 return jsonb_build_object('allowed',permitted,'remaining',20-n,
 'reset_epoch',ceil(extract(epoch from retained[1]+interval '15 minutes'))::bigint);
end; $rate$;
revoke all on function public.identity_rate_rolling_hit(text) from public,anon,authenticated;
grant execute on function public.identity_rate_rolling_hit(text) to service_role;
create function public.identity_rate_rolling_cleanup()
returns integer language plpgsql security invoker set search_path='' as $cleanup$
declare removed integer;
begin
 with expired as (select key_digest from public.identity_rate_rolling
 where expires_at<=clock_timestamp() order by expires_at,key_digest limit 1000 for update skip locked)
 delete from public.identity_rate_rolling r using expired e where r.key_digest=e.key_digest;
 get diagnostics removed=row_count;
 return removed;
end; $cleanup$;
revoke all on function public.identity_rate_rolling_cleanup() from public,anon,authenticated;
grant execute on function public.identity_rate_rolling_cleanup() to service_role;
commit;
