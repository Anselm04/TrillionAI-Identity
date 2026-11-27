\set ON_ERROR_STOP on
begin;
set local role service_role;
do $test$
declare result jsonb; i integer; stamp timestamptz:=clock_timestamp();
begin
 -- Seed requests from just before the current fixed-window boundary.
 insert into public.identity_rate_rolling values(repeat('a',64),
 array_fill(stamp-interval '14 minutes',array[20]),stamp+interval '1 minute');
 result:=public.identity_rate_rolling_hit(repeat('a',64));
 if (result->>'allowed')::boolean or (result->>'remaining')::integer<>0 then raise exception 'rolling quota bypass'; end if;
 update public.identity_rate_rolling set admitted_at=array_fill(stamp-interval '16 minutes',array[20]),expires_at=stamp-interval '1 minute' where key_digest=repeat('a',64);
 for i in 1..25 loop
  result:=public.identity_rate_rolling_hit(repeat('a',64));
  if (result->>'allowed')::boolean is distinct from (i<=20) then raise exception 'rolling quota mismatch %',i; end if;
 end loop;
 if (select cardinality(admitted_at) from public.identity_rate_rolling where key_digest=repeat('a',64))<>20 then raise exception 'unbounded admitted timestamps'; end if;
 insert into public.identity_rate_rolling values(repeat('b',64),array[stamp-interval '16 minutes'],stamp-interval '1 minute');
 if public.identity_rate_rolling_cleanup()<>1 then raise exception 'cleanup mismatch'; end if;
 if has_function_privilege('anon','public.identity_rate_rolling_hit(text)','execute') or has_function_privilege('authenticated','public.identity_rate_rolling_hit(text)','execute') then raise exception 'unsafe grants'; end if;
end;$test$;
rollback;
