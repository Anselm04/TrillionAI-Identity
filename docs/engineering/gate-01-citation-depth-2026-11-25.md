# Gate 1 — citation-depth checkpoint

Pinned source: `ca74a61593c412c17295dd02f9a751fa62f9d83a`.
Previous audit head: `e1e191b82ba0fd7de1c192218338ddb7ee973e3d`.

## Evidence granularity

The 135 requirement rows collapse into 39 distinct evidence-path/statement groups. Shared citations are not independently sufficient proof of each requirement. Review specific acceptance claims without upgrading adjacent controls into implemented functionality.

| Requirement | Independent evidence | Disposition |
|---|---|---|
| 30 Protected pages | `backend/src/guards.ts:11–46` validates bearer, active session, confirmed email and role/MFA before allowing protected API access. | Backend guard source confirmed; frontend route/UI acceptance still unqualified. |
| 68 Backup codes | `docs/MFA_BACKUP_RECOVERY.md:3–16` explicitly states the configured design uses separate verified authenticators instead of recovery codes. | Existing partial classification reflects alternative recovery mechanism, not implemented recovery codes. Exact feature remains unestablished; product disposition required. |
| 74 Account lockout | `backend/src/server.ts:59` configures request rate limiting; `:108–124` handles provider authentication and 429 responses. Neither establishes an account-specific lockout policy. | Original partial classification is adjacent mitigation evidence only. Exact lockout remains unverified; provider policy and abuse tests needed. |
| 83 One-time code/link security | `sdk/typescript/oauth.ts:280–320` consumes tab-scoped authorization state before exchange and explicitly distinguishes this from server-side one-time codes. | Application replay guard confirmed; issuer-side single-use and expiry acceptance remain unverified. Original source classification must not imply provider qualification. |

No original evidence or classifications overwritten. These are interpretive caveats, not changes to the canonical counts. Remaining citation groups require requirement-specific evidence review; Gate 1 remains open. No source repairs, manual test dispatch, live provider calls, merges or deployments. Existing offline PR CI may run automatically after this documentation-only commit.
