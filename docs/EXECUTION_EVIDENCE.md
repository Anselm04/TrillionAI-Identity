# Engineering evidence — PR #2

**Scope**: authorization-only verification, NOT release certification.

## Executed locally (isolated source subsets)
- Fetched `backend/src/authz.ts` and `backend/src/organisation.ts` from the PR branch through the connected GitHub integration.
- Confirmed the copied source files exactly matched GitHub Git blob IDs:
  - authz: `b073a297f46e33415b22a009579e5cd7b502a648`
  - organisation: `cdccf8cdfe7cb05ae0372c5c125ff9a201726e0c`
- Ran `tsc --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext --outDir dist` on these two files: **passed** (TypeScript 5.8.3).
- Ran 11 isolated Node.js `node:test` authorization assertions (Node 22.16.0): **11 passed / 0 failed**, including email verification, owner MFA freshness and tenant membership checks.
- Those assertions are an independent local audit, not the repository's Vitest suite. A matching regression suite has been added to `backend/src/lifecycle.contract.test.ts`.

## Cannot execute in current runner
- This runner cannot resolve `github.com` or `registry.npmjs.org`; it cannot install the repo's backend/web dependencies or clone the private GitHub repo.
- Flutter is not installed.
- Backend/web `package-lock.json` are absent. They must be generated from an online development environment and committed before reproducible `npm ci` validation.
- SQL migration, real SMTP email, real user verification, owner/tenant integration tests and billing provider hooks remain unverified.
- GitHub Actions workflow is **manual-only** and has not been run.

## Hard gates
Do not merge PR #2, deploy it, enable paid services or call it functional until complete backend/web/Flutter builds, real database authorization tests and lifecycle tests pass. The original `main` branch and AppForge remain untouched.
