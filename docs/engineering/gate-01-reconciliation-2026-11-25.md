# Gate 1 — independent reconciliation checkpoint

Date: 2026-11-25 (Pacific/Auckland)

Pinned source: `ca74a61593c412c17295dd02f9a751fa62f9d83a`.
Prior audit head: `d1063caccf3305a131c08d5fe73aba42e6b3c7d2`.

## Verified results

- Independent recursive Git tree retrieval: 177 entries, 153 blobs and 24 directories, not truncated. All path/type/mode/blob SHA tuples match `inventory-ca74a615.json` with zero missing or additional entries.
- File ledger: 153 unique paths, exact inventory match. Requirement ledger: 135 unique numbered requirements, exact names matched against the pinned `docs/authentication-capability-register.md`. No wrong revision values or empty fields in either CSV.
- 445 requirement citation occurrences (62 distinct citation strings): all resolve when the appropriate revision is used. All 11 distinct line references in `backend/src/server.ts` are within the retrieved 730-line source; start lines inspected. This is not a complete semantic qualification of every citation.
- PR #35: open, draft, unmerged; inspected head `4003f2383400067699e5a68f522718659ef00856`. PR #37: open, unmerged at prior audit head.

## Append-only provenance correction

Requirements 5, 6 and 26 reference `docs/engineering/audit-checkpoint-01.md`. This is secondary audit evidence, not a file at the pinned source revision. Resolve it at prior audit head `d1063caccf3305a131c08d5fe73aba42e6b3c7d2`, blob `c57dba1c4335ba0afe7476a81a87aa319e84256a`. The checkpoint explicitly identifies the baseline and the draft PR #35. The other cited source paths resolve at the baseline. Retain original CSV rows and classifications; apply this provenance clarification when interpreting them. Do not infer implementation or runtime acceptance from the checkpoint.

## Gate disposition

Inventory and requirement identity reconciliation passed. Citation path/range existence passed with the above provenance clarification. Detailed semantic evidence review remains outstanding; Gate 1 is not declared complete. Gate 2 reproducible testing is not declared started or passed. Existing baseline workflows inspected: identity-pr15-offline.yml, identity-pr17-offline.yml, identity-validation.yml; the latter runs on pull requests and uses local fixtures/disposable PostgreSQL, with no deployment job. This documentation commit may trigger existing offline CI; no manual workflow dispatch, live provider tests, production changes, merge or deployment authorized or performed by this checkpoint.
