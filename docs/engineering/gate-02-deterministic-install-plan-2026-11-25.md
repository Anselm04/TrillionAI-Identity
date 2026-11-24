# Gate 2 — deterministic installation change proposal

Status OPEN. Documentation only; no implementation authorized by this record.
Pinned prior audit head: 77272b77cda75bd98100187133dde4885e7eac79.
Preserve run 85 (45509172718) and its 202 JS/Dart passing tests plus SQL assertions. Run 86 (45509496523), associated with the prior audit head, also completed successfully across backend, web, OAuth SDK, Flutter and postgres-recovery. No new count inferred from job status alone.

## Proposed exact file changes (pending authorization)

- Add backend/package-lock.json and web/package-lock.json: generate genuine npm v10 lockfiles in isolated checkout using Node 22.23.5/npm 10.9.9; retain existing direct dependency pins; review all resolved transitive versions, integrity fields and registry sources. Use npm install --package-lock-only --ignore-scripts --no-audit --no-fund in each directory only after authorization. Do not fabricate lock content or upgrade working dependencies merely to add locks.
- Add flutter/pubspec.lock using Flutter 3.50.1 and its bundled Dart SDK; capture dart --version. Preserve pubspec.yaml constraints unless an actual incompatibility requires a separately reviewed change. Run 85 observed supabase_flutter 2.18.3, http 1.6.0, qr_flutter 4.1.0, flutter_lints 5.0.0. These are reference resolutions, not a complete dependency graph or proof of future compatibility. Generate lock only after permission.
- Modify .github/workflows/identity-validation.yml: replace both npm install commands with npm ci (preserve appropriate existing lifecycle-script flags; review web build needs before changing them); pin Node to 22.23.5 and npm to 10.9.9 with version verification; pin Flutter 3.50.1, enforce pub lock with flutter pub get --enforce-lockfile after confirming command support, capture exact Dart version; ensure lockfiles remain unchanged after tests. Pin reviewed action commit SHAs, runner image label and PostgreSQL 16.16 image digest after verifying actual compatible values; do not invent digests or claim hosted runner bit-for-bit immutability. Preserve all existing five jobs and tests.
- Modify scripts/qualify-local.sh: remove automatic lock generation from normal qualification path, fail explicitly if any required lock missing, verify toolchain versions, use same locked installs and existing checks; separate authorized lock bootstrap from verification. Preserve nonzero exits and no-provider boundary.
- Review .github/workflows/identity-pr15-offline.yml and identity-pr17-offline.yml: historical branch-specific workflows; if retained for reuse, align install and toolchain rules, otherwise document historical scope without unnecessary edits.
- Keep scripts/qualify-recovery-postgres.sh and SQL assertions unchanged unless reproducibility evidence demonstrates a defect. Record exact image digest and client version; disposable database only.
- Update docs/LOCAL_QUALIFICATION.md after implementation to distinguish historical sandbox npm EUSAGE and registry access failure from current CI success. Document prerequisites, locked commands and exact evidence artifacts.
- No native runner creation during this step. Missing Android/iOS runners are explicit native packaging blockers, not a reason to rewrite existing Flutter code. Gate 2 requires recording native prerequisites; actual native packaging remains subsequent Gate 6 scope.

## Exit criteria

1. Three genuine committed lockfiles exist and match unchanged manifests or explicitly approved compatibility fixes; exact toolchain versions and resolved dependency graphs archived.
2. Two independent clean checkouts run backend/web npm ci and Flutter locked pub get with no lockfile changes. Capture versions, commands, exit codes and lock hashes. Registry access may be needed; offline means no live product services.
3. All five existing CI jobs pass on exact candidate SHA, with backend/web builds, checks and test counts, SDK and Flutter regression results, disposable PostgreSQL migration and audit assertions captured. Investigate any regression rather than deleting tests or relaxing protections.
4. Record native platform limitations and actual toolchain requirements, remaining provider acceptance exclusions and any unresolved migration-history coverage; no production changes or live calls.
5. Independently verify documentation, CI and candidate diff; no merge/deployment implied. Strict byte-identical hosted builds are not promised.

## Current blockers

Missing three locks; floating toolchain/action/container selectors; full resolved graph not archived; native runner absence; locked clean installs not executed. Historical docs record npm EUSAGE on missing locks. Run 85 and 86 pass evidence retained. No lock generation, code edits, workflow edits, native creation, manual live tests, merge or deployment performed. Documentation commits may trigger existing offline CI.
