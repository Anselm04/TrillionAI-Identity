#!/usr/bin/env bash
set -euo pipefail
# CI service only: fixed loopback host and unique disposable database names.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
for history in consolidated standalone_first consolidated_first; do
 db="identity_fk_ci_${history}_$$"
 createdb "$db"
 trap 'dropdb --if-exists "$db"' EXIT
 (
 export PGDATABASE="$db"
 psql -X -v ON_ERROR_STOP=1 -c 'create schema auth; create table auth.users(id uuid primary key);'
 psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261113000000_identity_core.sql
 psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261113000001_identity_organisations.sql
 if [[ "$history" == standalone_first ]]; then
  psql -X -v ON_ERROR_STOP=1 -f supabase/stripe-customers.sql
 fi
 psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261120000001_identity_tenant_billing_lifecycle.sql
 if [[ "$history" == consolidated_first ]]; then
  psql -X -v ON_ERROR_STOP=1 -f supabase/stripe-customers.sql
 fi
 expected=c
 if [[ "$history" == standalone_first ]]; then expected=r; fi
 psql -X -v ON_ERROR_STOP=1 -v expected_fk="$expected" -f scripts/test-stripe-fk-history.sql
 # Keep historical reproduction, then qualify convergence and replay.
 psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261128000002_identity_stripe_fk_consistency.sql
 psql -X -v ON_ERROR_STOP=1 -v expected_fk=c -f scripts/test-stripe-fk-history.sql
 psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261128000002_identity_stripe_fk_consistency.sql
 psql -X -v ON_ERROR_STOP=1 -v expected_fk=c -f scripts/test-stripe-fk-history.sql
 )
 dropdb "$db"
 trap - EXIT
done
