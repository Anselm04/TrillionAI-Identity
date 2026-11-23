# Passwordless email initiation (source integration)

The Node API provides `POST /auth/passwordless/email` with a JSON body containing only `email`. It uses the existing Supabase Auth `signInWithOtp` implementation and explicitly sets `shouldCreateUser: false`; this endpoint does not create accounts. The existing 15-minute auth request limiter applies. For accepted requests and recognized unknown-account provider responses it returns the same generic HTTP 202 message. Provider rate limiting returns 429; other delivery failures return 503.

The redirect is configured as `APP_URL/verified`. Before enabling the feature for customers, verify that the deployed callback page supports Supabase passwordless link redemption and securely establishes a session. The redirect URL must be allowlisted in Supabase Auth. Do not interpret an accepted request as confirmation that email was delivered.

Offline unit tests: `cd backend && npm run test:offline` (not executed in this source-only run). No provider credentials, live email, production configuration or deployment are required for these tests.

Reference/provenance: Supabase Auth via the already-pinned `@supabase/supabase-js` dependency in `backend/package.json`. No upstream source was copied or vendored. The React and Flutter sign-in screens now initiate email through the Node endpoint, while Supabase Auth retains ownership of OTP verification and session redemption. The Flutter unauthenticated API method is restricted to this one route and enforces HTTPS outside local development. This change does not implement enterprise SSO or passkeys.

## Mobile callback boundary

The initiation API intentionally accepts only `email`, not a caller-controlled redirect URL. It always uses the configured web callback (`APP_URL/verified`) to avoid open-redirect and arbitrary callback injection. Flutter can redeem an emailed numeric code with Supabase `verifyOTP(type: OtpType.email)`; a magic link currently returns to the **web** callback, not automatically to the Flutter application. Do not describe mobile magic-link redemption as complete.

Before adding mobile magic-link redemption, implement a dedicated registered mobile deep-link callback and platform link handling, then introduce a server-owned, allowlisted redirect selection without accepting arbitrary client URLs. Supabase Flutter documentation recommends a registered custom scheme on Android/iOS, a provider allowlist entry, and authentication-state observation; keep the provider's PKCE flow. Do not put tokens in logs or relay authorization codes between unrelated devices.

Reference: https://github.com/supabase/supabase-flutter/tree/main/packages/supabase_flutter (official upstream documentation; no source copied). This is a source-only integration note, not runtime qualification.
