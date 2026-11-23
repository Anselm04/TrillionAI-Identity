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
- A future support-assisted lost-factor process, if authorized, must be separately designed with strong identity proof, independently approved recovery, provider-supported administrative MFA operations, auditing, abuse controls, and revocation of sessions. It is **not currently implemented**. Never instruct users to share passwords or authenticator codes with support.

## Security boundaries

- Verified factor identifiers are **selection only**, never authorization. The Supabase challenge-and-verify endpoint and bearer AAL2 provide authentication.
- The web and Flutter clients refuse a second-factor setup at AAL1 when a factor already exists; Supabase Auth remains the authoritative enforcement point.
- Owner/admin MFA is required server-side. Client UX disables privileged factor removal, but a client restriction alone is not a system-wide policy on direct provider API usage; production policy requires a provider-side hook or equivalent authoritative control if privileged factor deletion must be forbidden universally.
- These tests are offline and do not certify a live provider migration or authenticator recovery procedure.

Reference bases: the repository's Supabase and Appwrite read-only reference libraries, Supabase Auth MFA enrollment/challenge API, and Identity's own role/assurance guards.
