# Gate 1 — semantic evidence review consolidation

Date: 2026-11-25 (Pacific/Auckland).
Pinned source: `ca74a61593c412c17295dd02f9a751fa62f9d83a`.
Parent audit checkpoint: `a717a9cc0ad81f05509703115f144d07a8981f83`.

## Scope and method

Append-only supplement to the definitive audit ledger and Gate 1 reconciliation checkpoint. Five review batches examined the requirement ledger and selected source excerpts across ranges 1–15, 16–33, 34–62, 63–90, 91–135. These cover all 135 requirement identities, but do not constitute exhaustive line-by-line review of all 153 files or semantic validation of every citation. No runtime acceptance is inferred. Existing classifications are retained in the original CSV. The earlier reconciliation established exact Git tree and requirement identities, and citation existence with one secondary-audit provenance correction (requirements 5, 6, 26).

## Consolidated source findings

- 1–15: registration and passwordless email calls exist. `backend/src/server.ts:73–76`, `web/src/PasswordlessSignIn.tsx:5–6`, `flutter/lib/main.dart:189,374,388`. Passwordless initiation disables automatic user creation; preserve this boundary and separately qualify signup policy.
- 16–33: `backend/src/server.ts:84–87,109–124` shows resend and verified-email login enforcement. `web/src/supabase.ts:6` configures session persistence, not a user-selectable remember-me feature. `sdk/typescript/README.md:5,13,17` distinguishes provider registration and server ID-token verification from existing PKCE tooling. No provider acceptance established.
- 34–62: `backend/src/refresh-session-guard.ts:8–25` binds refresh to verified user/session; `supabase/migrations/20261123000006_identity_session_revoke_atomic_audit.sql:15–22` implements transactional revocation/audit. `backend/src/server.ts:61,168–191` implements password rules and current-password verification. `flutter/lib/identity_api.dart:27–28` requires HTTPS except local development. Native storage, expiry and session caps remain unqualified.
- 63–90: `backend/src/authz.ts:18–20`, `backend/src/mfa.ts:4–10` establish privileged assurance/fresh TOTP checks. `backend/src/mfa-recovery-assessment.ts:26,59` explicitly denies unlock/reset authorization. `backend/src/server.ts:59` specifies the configured in-memory rate limiter, not distributed enforcement or account lockout. `:67–69` logs returned audit-write errors without failing the calling operation. Invitation issuance/revocation audit omissions remain documented in the definitive ledger; distributed rate limits belong only to Gate 4.
- 91–135: `backend/src/account-lifecycle.ts:6–17` supports Identity-owned export/cleanup checks; linked product adapters are not established. `supabase/account-ownership.sql:18,27–38` establishes last-owner protection; tenant boundaries require isolated testing. `backend/src/service-credentials.ts:17–26` generates 256-bit random keys with SHA-256 digests. `backend/src/server.ts:289–303` derives entitlements from provider state; `backend/src/stripe-webhook.ts:3–10` verifies signatures. `backend/src/server.ts:72` is static liveness, not dependency readiness. Admin, privacy and accessibility acceptance remain unresolved as recorded.

## Evidence correction: requirement 54

Original classification: unverified. Supplementary source disposition: partial (web autofill hints only). `web/src/vendor/supabase/login-form.tsx:37–39` specifies username and current-password autocomplete; `web/src/vendor/supabase/sign-up-form.tsx:60–64` specifies email and new-password autocomplete. Password-manager interoperability on browser/native clients is not proven. Proposed derived counts if this correction is applied: 33 implemented-source, 24 partial, 5 provider-dependent, 73 unverified; total 135. Original CSV counts remain 33/23/5/74. No qualification status changes.

## Rechecked conditional findings

- Flutter export: `flutter/lib/main.dart:317–321` awaits data and clipboard writes before unguarded setState. Source defect; reproduce offline before repair.
- Stripe FK: `supabase/stripe-customers.sql:3–6` declares ON DELETE RESTRICT; `supabase/migrations/20261120000001_identity_tenant_billing_lifecycle.sql:109–113` uses CREATE TABLE IF NOT EXISTS with ON DELETE CASCADE. This does not change an existing constraint. Migration history is unknown; test both histories in disposable PostgreSQL before any schema repair. No production failure asserted.

## Gate disposition

Initial semantic review of all requirement groups is recorded; remaining detailed citation accuracy and review-depth gaps must not be represented as fully resolved. Gate 1 remains open pending explicit reconciliation of remaining evidence-depth gaps; Gate 2 not started. No source repairs, manual test dispatch, live provider calls, merges or deployments performed. The documentation-only commit can trigger existing offline pull-request CI. No prior audit evidence overwritten.
