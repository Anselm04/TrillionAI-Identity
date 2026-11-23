#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
psql -X -v ON_ERROR_STOP=1 -f scripts/test-recovery-bootstrap.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261123000001_identity_mfa_recovery_intake.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261123000002_identity_mfa_recovery_reviews.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261123000003_identity_mfa_recovery_rejections.sql
psql -X -v ON_ERROR_STOP=1 -f scripts/test-recovery-legacy-seed.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261123000004_identity_mfa_recovery_case_versions.sql
psql -X -v ON_ERROR_STOP=1 -f scripts/test-recovery-versioned.sql

psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261120000002_identity_session_inventory.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261123000005_identity_session_inventory_hardening.sql
psql -X -v ON_ERROR_STOP=1 -f scripts/test-session-inventory.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261123000006_identity_session_revoke_atomic_audit.sql
psql -X -v ON_ERROR_STOP=1 -f scripts/test-session-atomic-audit.sql
