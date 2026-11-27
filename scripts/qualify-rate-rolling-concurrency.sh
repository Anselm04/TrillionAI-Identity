#!/usr/bin/env bash
set -euo pipefail
# Only disposable CI Postgres; independent connections contend on the same key.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
key=$(printf 'identity-rate-ci-%s' "$$" | sha256sum | cut -d' ' -f1)
pids=()
for i in $(seq 1 40); do
 (
  PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000' psql -XAtq -v ON_ERROR_STOP=1 -v key="$key" <<'SQL'
set role service_role;
select public.identity_rate_rolling_hit(:'key')->>'allowed';
SQL
 ) > "$tmp/$i" &
 pids+=("$!")
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
if (( failed )); then echo 'rate counter connection failed' >&2; exit 1; fi
[[ $(grep -hxc true "$tmp/"* | awk '{s+=$1} END {print s+0}') == 20 ]]
[[ $(grep -hxc false "$tmp/"* | awk '{s+=$1} END {print s+0}') == 20 ]]
psql -X -v ON_ERROR_STOP=1 -v key="$key" <<'SQL'
select set_config('identity.ci_rate_key', :'key', false);
do $test$
begin
 if (select count(*) from public.identity_rate_rolling where key_digest=current_setting('identity.ci_rate_key'))<>1 then raise exception 'duplicate key'; end if;
 if (select cardinality(admitted_at) from public.identity_rate_rolling where key_digest=current_setting('identity.ci_rate_key'))<>20 then raise exception 'timestamp bound failed'; end if;
end; $test$;
delete from public.identity_rate_rolling where key_digest=:'key';
SQL
