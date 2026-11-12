# TrillionAI Identity — local run and acceptance

This is an implementation branch, **not** a production-certified authentication system.
No Fly.io, Twilio or other paid infrastructure has been activated.

## Architecture
- ONE Supabase Auth project acts as the identity provider for apps that choose to use it.
- A common Supabase `user.id` identifies users. Each product must maintain its own tenant/data authorization boundaries.
- Customer signup requires email confirmation. Phone/SMS is **not required**.
- Owner identity is assigned **only after personal signup, email confirmation and verified TOTP enrollment**.
- Customer data, billing and deletion must be supplied as real app-specific hooks. Missing hooks fail closed; no dummy success responses.
- Password reset is performed through Supabase's verified recovery session, never by simply submitting an arbitrary logged-in JWT to a service-role password reset endpoint.

## Initial setup (real credentials are private)
1. Configure Supabase Auth → Email: Require email confirmation. Configure secure email change and TOTP MFA.
2. Configure an actual production-capable outbound SMTP service and its SPF/DKIM/DMARC records.
3. Configure the Auth Site URL and redirect allowlist. For web, include `http://localhost:5173/verified` and `http://localhost:5173/reset` for local testing. Production must use HTTPS.
4. Run the reviewed migration at `supabase/migrations/20261113000000_identity_core.sql` in the correct Supabase project; **do not apply it to another product's database without assessing existing tables.**
5. In `backend`, copy `.env.example` to `.env` and enter real values privately; never commit the service-role key. In `web`, copy its `.env.example` and enter only public keys.
6. From `backend`: `npm install && npm run check && npm test && npm run build && npm run dev`.
7. From `web`: `npm install && npm run check && npm run build && npm run dev`.
8. From `flutter`: `flutter create --platforms=android,ios,web .` if native runner files do not exist; `flutter pub get && flutter analyze && flutter test`. Then run with:
   `flutter run --dart-define=SUPABASE_URL=https://PROJECT.supabase.co --dart-define=SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY --dart-define=IDENTITY_API_URL=http://10.0.2.2:3000 --dart-define=AUTH_REDIRECT_URL=YOUR_REGISTERED_APP_LINK`
   Note: Android emulator can reach local API via `10.0.2.2`; iOS simulator, real devices and Flutter web need appropriate URLs. Real devices should use HTTPS.
9. Register app-link/Universal-Link handlers before mobile email/recovery callback testing. On Android/iOS this includes native platform configuration and an associated hosted link. Without this, mobile email links may not return to the app.
10. Owner bootstrap **only after the owner personally registers, confirms email, and enrolls authenticator MFA**:
    `cd backend && npm run assign-owner -- YOUR_VERIFIED_UUID YOUR_VERIFIED_EMAIL`.
    This is a privileged local operator operation with the service-role key. Never call it from a public route.

## Required acceptance tests — all must pass with real configured services
- New registration, valid confirmation link, expired link, resend and login-before-confirm denial.
- Wrong-password and unknown-email non-disclosure, rate limiting, logout and refresh.
- Password recovery opened from genuine email; recovery completion cannot be achieved with arbitrary existing access token.
- Email change requires confirmation; other identity stays unchanged until verified.
- Authenticator enrollment and challenge; verified AAL2 required for owner/admin routes.
- Customer, admin and owner role separation including direct API attempts to call privileged endpoints.
- Profile and account export with actual product data.
- Subscription cancellation with provider-confirmed status; Apple/Google subscriptions clearly direct to store management.
- Customer-initiated deletion with password reauthentication, confirmed direct billing cancellation and actual product cleanup; previously valid session denied afterward.
- Mobile app links, Android and iOS builds, Flutter analyzer, web build, Node.js typecheck and tests.
- Outage responses, tampered tokens, denial of service, audit protection and secure backup/rollback.

## Operational constraints
- Neither paid hosting nor SMTP was provisioned here.
- This repo's billing, export and deletion hooks intentionally reject incomplete integrations.
- Do not report production readiness until local and live integration acceptance tests pass.
- There is no final approval to integrate with AppForge or switch its identity provider.
