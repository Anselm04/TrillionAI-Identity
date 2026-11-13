# No-hosting qualification

Run `bash scripts/qualify-local.sh` in a disposable local checkout with Node 22, npm, and Flutter installed. The script does **not** deploy anything, call Stripe/Twilio/Fly.io, run Supabase migrations, or use service credentials. It only runs dependency installation, static analysis, unit tests, and builds.

If backend/web `package-lock.json` files are missing, it generates them using the npm registry. **Review and commit both lockfiles** before calling the builds reproducible; never invent lockfile contents.

The script exits nonzero if it cannot complete a step. If Flutter isn't installed, it exits with status 2 rather than falsely reporting full success.

### Current verified facts
- Offline Node 22 authorization/billing suite: 12 passed, using Git-blob-identical source and test inputs.
- Offline Node 22 web validation suite: 5 passed, using Git-blob-identical source and test inputs.
- Complete `npm ci` cannot run without lockfiles; the prior sandbox's attempts returned npm `EUSAGE`. The runner cannot access the npm registry.
- Flutter SDK is missing from the current execution environment.
- Real SMTP/Auth provider, multi-tenant database and cross-device verification remain future acceptance requirements.

See `docs/EXECUTION_EVIDENCE.md`.
