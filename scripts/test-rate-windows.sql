\set ON_ERROR_STOP on
begin;
set local role service_role;
do $test$
declare result jsonb; i integer;
begin
 for i in 1..25 loop
  result:=public.identity_rate_hit(repeat('a',64));
  if (result->>'allowed')::boolean is distinct from (i<=20) then raise exception 'quota mismatch at %',i; end if;
  if (result->>'remaining')::integer<>greatest(20-i,0) then raise exception 'remaining mismatch'; end if;
 end loop;
 if (select max(hits) from public.identity_rate_windows where key_digest=repeat('a',64))<>21 then raise exception 'counter saturation failed'; end if;
 if (public.identity_rate_hit(repeat('b',64))->>'allowed')::boolean is distinct from true then raise exception 'independent key denied'; end if;
 insert into public.identity_rate_windows values(repeat('c',64),0,1);
 if public.identity_rate_cleanup()<>1 then raise exception 'cleanup mismatch'; end if;
 if exists(select 1 from public.identity_rate_windows where window_start=0) then raise exception 'expired row retained'; end if;
 if has_function_privilege('anon','public.identity_rate_hit(text)','execute') or has_function_privilege('authenticated','public.identity_rate_hit(text)','execute') or has_function_privilege('anon','public.identity_rate_cleanup()','execute') or has_function_privilege('authenticated','public.identity_rate_cleanup()','execute') then raise exception 'unsafe RPC grant'; end if;
end; $test$;
rollback;
