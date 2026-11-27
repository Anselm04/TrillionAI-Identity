-- Shared fixed-window counter primitive. No client access; no credentials stored.
begin;
create table public.identity_rate_windows(
 key_digest text not null check(key_digest ~ '^[0-9a-f]{64}$'),
 window_start bigint not null,
 hits integer not null check(hits between 1 and 21),
 primary key(key_digest,window_start)
);
create index identity_rate_windows_expiry on public.identity_rate_windows(window_start);
alter table public.identity_rate_windows enable row level security;
revoke all on public.identity_rate_windows from public,anon,authenticated;
grant select,insert,update,delete on public.identity_rate_windows to service_role;
create function public.identity_rate_hit(p_key text)
returns jsonb language plpgsql security invoker set search_path='' as $rate$
declare current_window bigint; count_after integer;
begin
 if p_key is null or p_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_rate_key'; end if;
 current_window:=floor(extract(epoch from clock_timestamp())/900)::bigint*900;
 insert into public.identity_rate_windows as counters(key_digest,window_start,hits)
 values(p_key,current_window,1)
 on conflict(key_digest,window_start) do update set hits=least(counters.hits+1,21)
 returning hits into count_after;
 return jsonb_build_object('allowed',count_after<=20,'remaining',greatest(20-count_after,0),'reset_epoch',current_window+900);
end; $rate$;
revoke all on function public.identity_rate_hit(text) from public,anon,authenticated;
grant execute on function public.identity_rate_hit(text) to service_role;
-- Bounded maintenance, not part of request processing. Run periodically under service role.
create function public.identity_rate_cleanup()
returns integer language plpgsql security invoker set search_path='' as $cleanup$
declare removed integer;
begin
 with expired as (
 select key_digest,window_start from public.identity_rate_windows
 where window_start < floor(extract(epoch from clock_timestamp())/900)::bigint*900-900
 order by window_start,key_digest limit 1000 for update skip locked
 )
 delete from public.identity_rate_windows w using expired e
 where w.key_digest=e.key_digest and w.window_start=e.window_start;
 get diagnostics removed=row_count;
 return removed;
end; $cleanup$;
revoke all on function public.identity_rate_cleanup() from public,anon,authenticated;
grant execute on function public.identity_rate_cleanup() to service_role;
commit;
