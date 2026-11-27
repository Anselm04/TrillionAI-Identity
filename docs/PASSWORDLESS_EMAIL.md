# Passwordless email initiation — numeric OTP source qualification

POST /auth/passwordless/email accepts only email; the existing local auth limiter applies. The server uses Supabase Auth with shouldCreateUser:false and a server-owned /verified callback. Provider delivery results (including unknown account, provider throttling and failures) are intentionally neutral HTTP 202 to avoid explicit account enumeration. The local limiter still returns 429. Timing differences and direct provider access require separate deployment testing; this is not a guarantee against enumeration.

Configure the Supabase magic-link email template to include the numeric Token variable for code redemption; verify delivery and provider throttling in authorized staging. Web and Flutter redeem using the existing provider verifyOtp/verifyOTP method, not a custom token issuer. Backend authorization and MFA requirements are unchanged. Magic-link redemption across the server-initiated flow and browser PKCE is NOT qualified; mobile deep links are not implemented by this PR. Do not enable or advertise magic links until separately verified. No live provider settings changed.

Reference inspected: Supabase apps/docs/content/guides/auth/auth-email-passwordless.mdx blob 11fd2e40322171e9a80a39a636164d5c042425cc; Apache-2.0 LICENSE blob 49ea124025275674563eeff03af0f653ca49fdc0. The guide distinguishes numeric OTP redemption from PKCE token-hash magic links. No upstream code copied. Exact SDK implementation path lookup failed; provider runtime behavior remains unverified.

Qualification: existing five-job offline CI on reconciled revision required; no live email or production deployment. The existing Flutter authenticated transport is preserved, including legitimate query-string pagination.
