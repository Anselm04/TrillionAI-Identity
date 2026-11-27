# Engineering completion protocol
Owner direction: 25 November 2026. Applies to Identity; reusable by other products after approval.

## Inventory and analysis
1. Pin the full Git commit SHA. Enumerate tracked paths with `git ls-tree -r -z --full-tree HEAD`; include modes, object IDs and submodule pointers. Record excluded binary/generated/vendor files and reasons, never silently omit them.
2. Partition the inventory into bounded module/file chunks; split oversized files by line ranges with overlap. Each chunk records exact revision, paths, ranges, findings, symbols, dependencies and uncertainty. Persist checkpoints and resume unprocessed chunks. Track coverage by unique paths and ranges, not by model responses.
3. Reduce chunk evidence to module, subsystem and product assessments. Preserve traceable evidence IDs and contradictory findings; resolve cross-module callers, API contracts, schema and tests before concluding. A summary is not a substitute for underlying evidence.
4. At new revisions compare Git trees; invalidate changed evidence and affected reverse dependencies, including shared config, migrations and lockfiles. Preserve unaffected verified records; if impact is unknown, mark it unknown.
5. Search existing implementations, aliases, provider delegation, tests and prior PRs before declaring a gap. Only declare missing when the scoped inventory and relevant dependencies have been inspected and no implementation is located. Uninspected is never missing.

## Persistent feature ledger
For each approved requirement record stable ID, acceptance criteria, source paths/symbols, inspected revision, test commands and results, evidence links, dependencies, implementation status and independent qualification status. Implementation states: uninspected, partial, implemented, missing (evidence required), not applicable (reason). Qualification states: not run, failed, offline passed, live pending, live passed. Track date and revision for every result; do not equate merged PRs with independently verified test outcomes. Never store secrets or customer data.

## Change and completion gate
Before changing functional code, cite the requirement and concrete defect (reproduction, failed acceptance test, substantiated vulnerability, impacted dependency or approved scope change). If evidence is absent, investigate rather than rewrite. Reopen only the affected requirement and record why. Reuse proven existing implementations and retain the reference-first rules in AGENTS.md. Require relevant regression tests and existing offline CI; never label an unexecuted test passed. Do not bypass security controls.
When all approved source requirements are implemented and offline qualification passes at the reviewed revision, record engineering complete and stop adding speculative fixes. External provider and customer-flow tests are a separate stage, explicitly pending until authorized. No paid services, deployments or live provider calls under this protocol.

## Initial checkpoint
The full tracked inventory and feature-by-feature coverage have not yet been produced. No completeness percentage is claimed. Recent GitHub PR metadata identifies #36 as merged (Flutter MFA/session race hardening) and #35 as open draft (passwordless email initiation; full offline qualification pending). These are historical evidence leads, not independent proof of complete features. Check current branch and CI before changing or merging #35. Do not reopen #36 without the change gate above.
