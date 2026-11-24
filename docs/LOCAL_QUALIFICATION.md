# Local offline qualification — locked baseline

This guide applies to the Gate 2 branch of `Anselm04/TrillionAI-Identity`. “Offline” here means **no live authentication, billing, hosted database, or deployment operations**. A clean dependency installation can still require access to the trusted npm and pub registries. These are not air-gapped builds.

## Prerequisites

- A clean checkout of the selected commit with all three tracked locks:
  `backend/package-lock.json`, `web/package-lock.json`, and `flutter/pubspec.lock`.
- Node.js **22.23.5**, npm **10.9.9**, Flutter **3.50.1** with Dart **3.14.0**.
- Available npm and pub dependencies through trusted registries or a previously populated, verified cache.
- For the *separate* disposable PostgreSQL suite: a local PostgreSQL server compatible with the CI image (PostgreSQL 16.16 was observed), `psql`, and an isolated test database. Do not point the SQL harness at production or a customer database.

## Local source checks

From the repository root:

```bash
bash scripts/qualify-local.sh
```

The script checks the exact Node/npm/Flutter versions and the presence of **tracked** lockfiles, uses `npm ci` for backend and web, `flutter pub get --enforce-lockfile`, and executes the existing SDK, backend, web, and Flutter checks. It fails nonzero if Flutter is unavailable; it does **not** silently certify the repository. The script checks that lockfiles have not changed. It does not create or repair them.

`npm ci` installs the dependency tree and can recreate `node_modules`, but does not write lockfiles. Backend install uses `--ignore-scripts` to match CI; web install retains its existing lifecycle behavior.

The separate PostgreSQL regression harness is:

```bash
bash scripts/qualify-recovery-postgres.sh
```

Use this command **only** after confirming that `PGHOST`, `PGPORT`, `PGUSER`, and `PGDATABASE` target an isolated disposable PostgreSQL instance; the script sets local connection defaults internally and executes SQL against that database. Its scope includes recovery-case migrations, session inventory, and atomic audit rollback assertions. It does **not** qualify every migration history or production database policy.

## Verified hosted Gate 2 evidence

The PR #37 evidence report `docs/engineering/gate-02-closure-report-2026-11-25.md` records two independent passing locked-checkout runs:

- [Run 93 — 45511999143](https://github.com/Anselm04/TrillionAI-Identity/actions/runs/45511999143), commit `60c09c11f6756d8036a009851e6bd0f361ac1302`.
- [Run 94 — 45512245041](https://github.com/Anselm04/TrillionAI-Identity/actions/runs/45512245041), commit `cfdc79908796d4accd7711065ebb05bb136f1b45`.

Each reported **111 backend, 22 web, 52 OAuth SDK, and 17 Flutter tests** (202 in total), plus the PostgreSQL assertions. All five jobs passed on both runs; the three lockfiles were unchanged. Node/npm/Flutter/Dart and PostgreSQL versions matched. A later run, [45512693243](https://github.com/Anselm04/TrillionAI-Identity/actions/runs/45512693243), also passed all five jobs at commit `d9bf15f43896334f6ed8620ee637056be3a4e45d` with the same locked installation steps.

## Reproducibility boundary

`.github/workflows/identity-validation.yml` fixes the Node and Flutter versions, checks npm/Dart versions, uses full Git commit SHAs for GitHub actions, and identifies PostgreSQL by an immutable image digest. `ubuntu-26.04` selects a hosted OS family, not a bit-for-bit immutable VM image. The conditionally installed `postgresql-client` package, if absent from the runner, can resolve a newer distro package. Flutter's `stable` channel is paired with an exact SDK version. These do **not** invalidate the proved lockfile-reproducibility gate; they limit claims of **entire-machine byte-identical builds**. Do not add a new container platform or additional tooling merely to remove this accepted limitation.

Android and iOS runners are not yet present. Native build and device acceptance belong to their separately approved later scope; no native binaries have been qualified. Real Supabase Auth, SMTP, Stripe, customer tenants, and deployed database state also require separate authorization and qualification.

Historical `EUSAGE` failures and missing-lock descriptions in older evidence documents apply to the *pre-lockfile* baseline and should not be interpreted as current status. Preserve those documents as provenance rather than rewriting history.
