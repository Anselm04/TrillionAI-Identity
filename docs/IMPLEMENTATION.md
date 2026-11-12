# Actual implementation status

This branch introduces a working initial foundation, **not** a certified production identity service.

- Backend: Express API with Supabase-token verification and fail-closed owner AAL2 authorization.
- Flutter: basic email signup, password signin, recovery request, password change and signout against Supabase Auth.
- Required before live use: configure a real production-capable authentication email sender and redirect/deep-link handling; complete email-confirmation callback, reset-password callback, MFA enrolment/challenge, account deletion, device/session revocation, rate limiting and end-to-end testing.
- No Twilio, Fly.io, Redis, purchases or production deployments are activated by this branch.
- Never set OWNER_SUPABASE_USER_ID until the owner has **personally** signed up and confirmed their email. Do not grant owner privilege using email alone.
- All owner-only routes must deny access if OWNER_SUPABASE_USER_ID is unset or token aal is not aal2.
- The Flutter example and API are independent components, not yet integrated into AppForge.
- Flutter must receive the **publishable** key only; no service role credentials in mobile applications.

## Local commands (no cloud provisioning)

```sh
cd backend
npm install
npm run check
npm test
npm run build
cp .env.example .env
# Edit .env locally, never commit real values.
npm run dev
```

```sh
cd flutter
flutter pub get
flutter analyze
flutter run --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co --dart-define=SUPABASE_PUBLISHABLE_KEY=YOUR_KEY
```
