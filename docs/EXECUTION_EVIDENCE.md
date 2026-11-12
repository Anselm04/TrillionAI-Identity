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
