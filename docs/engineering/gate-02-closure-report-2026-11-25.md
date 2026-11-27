# Gate 2 closure assessment — 2026-11-25

**Two-run locked hosted CI qualification: PASS. Overall Gate 2: OPEN pending reconciliation of remaining reproducibility scope.** No Gate 3, merge, deployment or live acceptance authorized.

| Evidence | First qualification | Second qualification |
|---|---|---|
| Run | [93 / 45511999143](https://github.com/Anselm04/TrillionAI-Identity/actions/runs/45511999143) | [94 / 45512245041](https://github.com/Anselm04/TrillionAI-Identity/actions/runs/45512245041) |
| Head | 60c09c11f6756d8036a009851e6bd0f361ac1302 | cfdc79908796d4accd7711065ebb05bb136f1b45 |
| Backend | 43 offline + 68 Vitest | 43 offline + 68 Vitest |
| Web | 22 | 22 |
| OAuth SDK | 52 | 52 |
| Flutter | 17 | 17 |
| PostgreSQL | 3 PASS notices | 3 PASS notices |
| Total JS/Dart | 202 passed | 202 passed |
| Lockfile diff | zero | zero |

All ten jobs passed. Fresh checkout and locked install steps inspected in both runs. Backend/web npm ci, Flutter pub get --enforce-lockfile, typecheck/build/analysis and tracked lockfile diff checks passed. Second head differs only by docs/engineering/gate-02-locked-install-verification-2026-11-25.md. Git blob IDs for all three locks independently match between heads. Both runs observed Node 22.23.5, npm 10.9.9, Flutter 3.50.1, Dart 3.14.0, PostgreSQL 16.16. Identical committed dependency resolutions and observed toolchain versions, not a claim of byte-identical runner environments.

## Artifact provenance
Source run 45510421898; successful transfer run 45511599402; lock commit f17e2bafb0a3f0e6ccfa1978465ac8e1bb4e7a49. Cleanup a261a7ce6827f9d2fd3f4f2418c598e6edd8078d removed temporary write-enabled workflow. Remaining workflows inspected read-only.
- backend/package-lock.json SHA-256 82c8d6cb7cc1d33816dc9b8bba6e7b33313552c270a0bf2d0ca9f87aaad8cc91
- web/package-lock.json SHA-256 83cf4e485da092c3951faa7666753291c11d0bd9e04d51770e62b3d5b4ae4089
- flutter/pubspec.lock SHA-256 342c9aebd048147f4d7581d81b0e7b2f2ceaba63d0c7c54f16da96b93a9a30f8

## Residual limitations
Local qualification script still needs lock enforcement alignment. Hosted runner, action version selectors and PostgreSQL image tag remain movable; observed consistency does not establish immutable infrastructure. Native packaging deferred by owner. Resolve or explicitly accept these bounded limitations before overall gate closure. No application source changes in this report.
