# Passwordless email initiation (source integration)

The Node API provides `POST /auth/passwordless/email` with a JSON body containing only `email`. It uses the existing Supabase Auth `signInWithOtp` implementation and explicitly sets `shouldCreateUser: false`; this endpoint does not create accounts. The existing 15-minute auth request limiter applies. For accepted requests and recognized unknown-account provider responses it returns the same generic HTTP 202 message. Provider rate limiting returns 429; other delivery failures return 503.

The redirect is configured as `APP_URL/verified`. Before enabling the feature for customers, verify that the deployed callback page supports Supabase passwordless link redemption and securely establishes a session. The redirect URL must be allowlisted in Supabase Auth. Do not interpret an accepted request as confirmation that email was delivered.

Offline unit tests: `cd backend && npm run test:offline` (not executed in this source-only run). No provider credentials, live email, production configuration or deployment are required for these tests.

Reference/provenance: Supabase Auth via the already-pinned `@supabase/supabase-js` dependency in `backend/package.json`. No upstream source was copied or vendored. This change does not implement enterprise SSO, passkeys or email OTP verification UX.
