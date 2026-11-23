# Authenticator loss and recovery (Identity)

Identity uses Supabase Auth as the **only** authority for TOTP factors. Supabase Auth does not expose TOTP recovery codes, but it supports multiple enrolled factors. Identity deliberately does not invent recovery codes, downgrade a privileged session to AAL1, accept a password-reset link as MFA proof, or permit a privileged MFA bypass.

## Prevent lockout

1. Sign in and complete MFA with the current verified authenticator.
2. On the account security screen, choose **Enroll backup authenticator**.
3. Configure the new factor on a **separate, secured device** and verify it with the provider. Its secret and QR code are shown only during enrollment; they are never saved by Identity.
4. At the next sign-in, select **Authenticator 1** or **Authenticator 2** and complete the provider-issued challenge. Provider verification is necessary to upgrade the bearer token to AAL2.
5. Preserve the secondary device independently, and keep contact/recovery details up to date.

## Lost primary factor

- If another verified TOTP factor is available, choose it on the verification screen. Then use provider-authorized account management to review the remaining factors.
- If **every** enrolled factor is lost, email/password reset, magic links, and ordinary support access **cannot** grant AAL2. Identity does **not** offer an automatic reset or an emergency owner bypass.
- The **lost-factor intake** is implemented as a rate-limited `POST /account/mfa/recovery-request` from a still-authenticated, email-verified account with an active Supabase session and an existing verified TOTP factor. It accepts an empty JSON object, creates an idempotent pending case in `identity_mfa_recovery_requests`, and writes `mfa_recovery_requested` to the audit log. It does **not** remove or reset a factor or restore AAL2.
- If every factor is lost **and no authenticated session remains**, this endpoint is inaccessible. Do not present a password reset or login link as an equivalent of successful MFA.
- A future support-assisted lost-factor **resolution**, if authorized, must be separately designed with strong independent identity proof, independently approved recovery, provider-supported administrative MFA operations, auditing, abuse controls, and session revocation. It is **not currently implemented**. Never instruct users to share passwords or authenticator codes with support.

## Security boundaries

- Verified factor identifiers are **selection only**, never authorization. The Supabase challenge-and-verify endpoint and bearer AAL2 provide authentication.
- The web and Flutter clients refuse a second-factor setup at AAL1 when a factor already exists; Supabase Auth remains the authoritative enforcement point.
- Owner/admin MFA is required server-side. Client UX disables privileged factor removal, but a client restriction alone is not a system-wide policy on direct provider API usage; production policy requires a provider-side hook or equivalent authoritative control if privileged factor deletion must be forbidden universally.
- These tests are offline and do not certify a live provider migration or authenticator recovery procedure.

Reference bases: the repository's Supabase and Appwrite read-only reference libraries, Supabase Auth MFA enrollment/challenge API, and Identity's own role/assurance guards.

## Engineering / deployment qualification

- Migration `20261123000001_identity_mfa_recovery_intake.sql` is source only until applied to an Identity-owned database in a separately authorized deployment.
- The intake function is restricted to `service_role`; the browser/mobile SDKs never call the RPC directly and must not receive service credentials.
- The authenticated API never accepts a user ID, role, factor ID, approval decision, unlock token, or arbitrary recovery action in the request body.
- The primary key on `user_id` prevents repeat requests from generating new cases; the application limiter bounds repeated endpoint calls.
- Pending cases remain pending; there is intentionally **no** public review, approval, token generation, account reset, direct factor-management, or special owner bypass.
- Approval, if engineered separately, must implement explicit reviewer separation, tamper-resistant review evidence, fail-closed state transitions, and independently enforceable provider-side MFA changes. Offline CI does not certify production migration behavior.

## Owner-only review queue

The recovery intake can be inspected, **not approved**, using
`GET /owner/mfa-recovery/requests?limit=25&after=<user_uuid>`.
The endpoint requires Identity's existing `guard("owner")`, which verifies the
Supabase bearer, active non-revoked session, owner role, AAL2 and a fresh
timestamped TOTP authentication event. It never accepts an arbitrary role,
user ID, status filter or provider factor ID from the browser.

- Pending cases are paginated with a stable UUID cursor, at most 50 cases per
  request. The API exposes only the user ID, role recorded at intake and
  creation time.
- The `RecoveryReview` web component is visible only to the owner; server
  authorization remains mandatory for every request. No recovery secrets,
  email addresses, tokens or MFA factor identifiers are returned.
- This is read-only. There is deliberately no approve, dismiss, unlock,
  credential-reissue or provider MFA unenrollment operation.
- The migration that creates `identity_mfa_recovery_requests` must be deployed
  separately with owner authorization before this queue can operate. Offline
  unit tests cannot certify database RLS or provider integration.

## Independent review attestations (not recovery authorization)

A separate audit-only workflow records a reviewer’s declaration that independently
held evidence was examined. The endpoint
`POST /admin/mfa-recovery/requests/:caseUserId/reviews` requires `guard("admin")`
and a recent provider-verified AAL2 TOTP challenge. The owner or an admin can
review a case, but **never their own case**.

The request body is strictly limited to `outcome` (`identity_evidence_sighted`
or `insufficient_evidence`), `method` (`in_person`, `verified_callback`,
or `verified_external_record`) and `evidence_reference_sha256`, a lowercase
64-character SHA-256 fingerprint of an independent reference held outside
Identity. Do not submit an identity document, personal data, passwords, OTP
codes or a fingerprint of a low-entropy personal identifier.

The `identity_mfa_recovery_reviews` database migration provides:

- A composite primary key preventing a reviewer from attesting twice to one case.
- Database checks against reviewing your own case, invalid method or outcome,
  unexpected evidence formats, inactive reviewer sessions and non-privileged
  reviewers. The pending case row is locked during each insert.
- An append-only review record and a corresponding audit entry written in the
  same transaction, using an invoker-rights function available only to
  `service_role`.
- No self-service or reviewer action that changes MFA factors, roles, tokens,
  sessions, entitlements, or account status.

The web queue is available to both admin and owner roles; its server-side
`/admin/mfa-recovery/requests` endpoint requires fresh privileged MFA.
These attestations are **human declarations, not automated verification
proof**. The present engineering does not automatically resolve or authorize
account recovery, even if multiple attestations say evidence was sighted.

This migration depends on `20261123000001_identity_mfa_recovery_intake.sql`.
Both are unapplied until a separately authorized deployment. PostgreSQL
transactions and Supabase provider operations require their own integration
qualification: successful Node, web and Flutter CI is not proof of running
database state.
