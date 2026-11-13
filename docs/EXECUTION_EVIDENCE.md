# Engineering evidence — PR #2

**Scope**: authorization-only verification, NOT release certification.

## Executed locally (isolated source subsets)
- Fetched `backend/src/authz.ts` and `backend/src/organisation.ts` from the PR branch through the connected GitHub integration.
- Confirmed the copied source files exactly matched GitHub Git blob IDs:
  - authz: `b073a297f46e33415b22a009579e5cd7b502a648`
  - organisation: `cdccf8cdfe7cb05ae0372c5c125ff9a201726e0c`
- Ran `tsc --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext --outDir dist` on these two files: **passed** (TypeScript 5.8.3).
- Ran 11 isolated Node.js `node:test` authorization assertions (Node 22.16.0): **11 passed / 0 failed**, including email verification, owner MFA freshness and tenant membership checks.
- Fetched and copied `backend/src/hooks.ts` and `backend/src/billing.ts`, verifying Git blob SHA equivalence (`1325d23ef6a4955cba753227f26082fad68f1af3` and `0f13ef55290c5df3fa3c1b0b60947f42b586359f`).
- Recompiled `authz.ts`, `organisation.ts`, `hooks.ts`, and `billing.ts` with TypeScript 5.8.3: **passed**.
- Executed 6 billing cancellation assertions with Node.js `node:test`: **6 passed / 0 failed**. These covered missing hooks, provider exceptions, rejected cancellation, a claimed-success-but-still-active subscription, failed status recheck, and confirmed cancelled status. **Total standalone assertions run: 17 passed / 0 failed.**
- Those assertions are an independent local audit, not the repository's Vitest suite. Matching regression suites have been added to `backend/src/lifecycle.contract.test.ts` and `backend/src/billing.test.ts`.

## Cannot execute in current runner
- This runner cannot resolve `github.com` or `registry.npmjs.org`; it cannot install the repo's backend/web dependencies or clone the private GitHub repo.
- Flutter is not installed.
- Backend/web `package-lock.json` are absent. They must be generated from an online development environment and committed before reproducible `npm ci` validation.
- SQL migration, real SMTP email, real user verification, owner/tenant integration tests and billing provider hooks remain unverified.
- GitHub Actions workflow is **manual-only** and has not been run.

## Hard gates
Do not merge PR #2, deploy it, enable paid services or call it functional until complete backend/web/Flutter builds, real database authorization tests and lifecycle tests pass. The original `main` branch and AppForge remain untouched.

## Confirmed repair changes
- Web registration/recovery/resend now use its browser Supabase client and PKCE flow consistently; source commit `f58e1eadf70b5c33f32e9ef9f9a69b1d91b27d92`. Live email-link test **not executed**.
- Backend direct subscription cancellation now requires provider acknowledgment **and** a fresh stored status of `cancelled` before returning success. Deletion reuses the same verification. This is unit-tested, but not integrated with a live provider.
- Added Vite's official client type reference so `import.meta.env` is typed by the installed Vite package.

## Database compatibility check (read-only)
- Inspected connected Supabase public table inventory. One active project contains AppForge tables plus an existing `public.profiles` with primary key `id`, **not** the proposed Identity `user_id` key.
- The initial Identity migration's `CREATE TABLE IF NOT EXISTS public.profiles` would not upgrade that incompatible existing table. Applying it there would leave Identity profile queries broken and would risk colliding with AppForge's data model.
- Fixed the migration before application: Identity now uses `public.identity_profiles` and `public.identity_global_roles`, with corresponding server queries and owner bootstrap references corrected (commit `82a472e6d9f44913bdc5eaf5622232d23f57be34`).
- **No SQL migration was applied.** The other connected project timed out during a read-only metadata request and has not been identified as the approved Identity deployment target.

## Current endpoint acceptance prerequisites
- Decide which Supabase Auth project is the canonical Identity authority, and verify that adopting it will not invalidate existing AppForge accounts.
- Generate and commit backend/web dependency lockfiles in an online build environment; run real CI and Flutter analysis.
- Confirm browser PKCE email verification and reset callbacks with genuine SMTP and redirects.
- Real connected-product adapters must be implemented and tested before account deletion or cancellation can succeed.

## 13 November — next engineering milestone, offline verification
- Node 22.16.0 standalone test run against **Git-blob-identical** copies of `backend/src/authz.ts`, `backend/src/organisation.ts`, `backend/src/mfa.ts`, `backend/src/billing.ts`, and `backend/test/offline.test.mjs` (12 assertions): **12 passed, 0 failed**.
- Originally caught `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` caused by TypeScript parameter properties in `BillingVerificationError`; removed the unsupported constructor syntax in GitHub commit `6392f90546457698f797898c34a4e659ca3e3c27`; reran the suite successfully.
- Independent registration validation checks: five `node:test` cases (valid email/password, malformed email, short/long password and confirmation mismatch): **5 passed**; standalone TypeScript compilation also passed.
- Combined **latest milestone** offline runs: 17 passed / 0 failed. Earlier assertions may cover similar behavior; these are *not* 17 independent integration workflows.
- The browser signup and recovery code is committed but not executed against actual Supabase/Auth SMTP. Full project npm/Flutter builds remain unexecuted due offline runner restrictions.
- Since the validation workflow exists only in PR #2, the `workflow_dispatch` job cannot currently be relied on as available from the repository default branch. Do not change main or enable automatic workflow triggers just to simulate an executed build.
