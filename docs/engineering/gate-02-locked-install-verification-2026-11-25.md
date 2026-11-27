# Gate 2 — locked install verification checkpoint

Gate 2 remains OPEN. PR #37 remains unmerged. This documentation-only successor triggers the existing read-only offline CI for a second independent clean qualification; no production code or dependency changes.

## Provenance and cleanup

Original lock artifacts: run 88, ID 45510421898; successful one-time transfer run 45511599402; exact three-file lock commit f17e2bafb0a3f0e6ccfa1978465ac8e1bb4e7a49. Committed file SHA-256 hashes independently matched transfer output:
- backend/package-lock.json: 82c8d6cb7cc1d33816dc9b8bba6e7b33313552c270a0bf2d0ca9f87aaad8cc91
- web/package-lock.json: 83cf4e485da092c3951faa7666753291c11d0bd9e04d51770e62b3d5b4ae4089
- flutter/pubspec.lock: 342c9aebd048147f4d7581d81b0e7b2f2ceaba63d0c7c54f16da96b93a9a30f8

Cleanup commit a261a7ce6827f9d2fd3f4f2418c598e6edd8078d removed the one-time write-enabled workflow. All three remaining workflow files independently inspected at 60c09c11f6756d8036a009851e6bd0f361ac1302 declare contents: read; checkout does not persist credentials. No temporary write grant remains in those workflow definitions.

## First locked clean CI qualification

Run 93 / ID [45511999143](https://github.com/Anselm04/TrillionAI-Identity/actions/runs/45511999143), head 60c09c11f6756d8036a009851e6bd0f361ac1302. All five jobs completed successfully; actual logs and steps inspected. Backend: 43 offline + 68 Vitest tests, typecheck/build passed; web: 22 tests, typecheck/build passed; OAuth SDK: 52 tests; Flutter: 17 tests, analysis passed; disposable PostgreSQL: recovery migration, session inventory, atomic audit rollback assertions passed. Total 202 JS/Dart tests plus SQL assertions.

Backend/web npm ci and Flutter pub get --enforce-lockfile succeeded on fresh hosted checkouts; all three tracked lockfile diff checks passed. Observed Node 22.23.5, npm 10.9.9, Flutter 3.50.1, Dart 3.14.0, PostgreSQL 16.16.

## Remaining scope

Second independent locked qualification pending; verify this successor differs only by this document before counting its results. Local qualification script still contains automatic lock bootstrap and needs alignment; hosted OS/action selectors and PostgreSQL tag remain movable. Exact image/action pins and full reproducibility boundary remain to be reconciled. No native runners or production repairs authorized; no live tests, merge, deployment or Gate 3.
