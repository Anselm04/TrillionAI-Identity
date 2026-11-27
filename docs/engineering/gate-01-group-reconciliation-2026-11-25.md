# Gate 1 — finite evidence-group reconciliation

Pinned baseline: ca74a61593c412c17295dd02f9a751fa62f9d83a. Prior audit head: e31939585349ffeca2718345f075016f348600a9.

The 39 groups below partition all 135 requirements exactly once, using the existing CSV's exact shared citation-path and evidence-statement pairs. This is an append-only synthesis of the prior review batches, not a new exhaustive line-by-line audit. Original classifications are retained for traceability; qualification is not inferred. See the prior reconciliation, semantic review and citation-depth checkpoints for provenance and source excerpts.

| Group | Requirement IDs | Original classification | Bounded evidence disposition |
|---|---|---|---|
| 1 | 1, 16, 17, 25, 27, 58, 60 | implemented-source | Auth entry points located; provider behavior and generic error enumeration need acceptance. |
| 2 | 2, 3, 4, 7, 8, 9, 10, 11, 13, 14, 15 | unverified | Scope descriptions and nearby code are not proof; retain unverified. |
| 3 | 5, 6, 26 | partial | Passwordless initiation and OTP located; no automatic creation; PR35 secondary provenance. |
| 4 | 12, 29, 30, 51, 83, 127 | implemented-source | Validation/redirect source located; protected pages and issuer single-use qualifications remain separate. |
| 5 | 18, 21, 55, 56, 59 | provider-dependent | Provider-dependent; no issuer configuration or behavior proven. |
| 6 | 19, 20, 22, 23, 24 | unverified | No specific implementation established; retain unverified. |
| 7 | 28, 31, 33 | unverified | Persistence is not remember-me control; QR login and enterprise federation unverified. |
| 8 | 32 | partial | PKCE helper exists; provider registration and SAML acceptance outstanding. |
| 9 | 34, 35, 36, 37, 44, 45, 46 | implemented-source | Bearer/session/refresh/revocation source exists; offline integration required. |
| 10 | 38 | partial | not_after enforcement exists; idle and absolute policy not fully qualified. |
| 11 | 39, 41, 43, 47, 48 | unverified | Bearer flow is not evidence of cookies, CSRF, fixation, trusted devices or session caps. |
| 12 | 40 | partial | HTTPS configuration exists; deployed TLS unverified. |
| 13 | 42, 81 | partial | Helmet/CORS source exists; rendered CSP/XSS qualification outstanding. |
| 14 | 49 | unverified | Native runner and secure storage qualification absent. |
| 15 | 50 | unverified | UI continuity is not cross-tab synchronization evidence. |
| 16 | 52, 53, 54, 57, 61, 62 | unverified | Requirement 54 web autocomplete partial evidence; other features retain unverified. |
| 17 | 63, 64, 66, 67 | unverified | TOTP is not evidence of alternative MFA methods. |
| 18 | 65, 69, 71, 72 | implemented-source | TOTP and fresh assurance source exists; enrollment/removal and reauth tests required. |
| 19 | 68 | partial | Backup authenticator is not recovery code; exact requirement unresolved. |
| 20 | 70, 101 | partial | Review/assessment only; no reset/unlock authorization; owner governance external. |
| 21 | 73, 74, 75, 76 | partial | Configured memory limiter; no account lockout proof; distributed controls Gate 4. |
| 22 | 77, 78, 79, 80, 82, 84 | unverified | Adjacent safeguards do not establish exact attack controls. |
| 23 | 85, 86, 88, 89, 90 | unverified | Notification and DNS/provider behaviors unverified. |
| 24 | 87 | partial | Atomic audit exists for revocation; helper and invitation gaps remain. |
| 25 | 91, 92 | implemented-source | Profile and email-change source exists; provider confirmation acceptance pending. |
| 26 | 93, 94, 95, 96, 97, 98, 99 | unverified | No exact account-management capability established. |
| 27 | 100, 121, 122 | partial | Identity-owned lifecycle source exists; linked products and migration history outstanding. |
| 28 | 102, 103, 104, 105, 106, 107, 108, 109 | unverified | Approved design is not implemented global admin functionality. |
| 29 | 110, 111, 114, 115, 117 | unverified | Tenant membership is not account linking or federation evidence. |
| 30 | 112, 113, 116, 133 | implemented-source | Tenant permission and invitation source exists; hostile-caller SQL qualification required. |
| 31 | 118, 119, 120, 123, 124, 125 | unverified | Design and requirement documents are not privacy/accessibility acceptance. |
| 32 | 126 | implemented-source | Core schema source exists; deployed schema/restore unverified. |
| 33 | 128 | partial | Key boundary and HTTPS settings exist; actual environment isolation unverified. |
| 34 | 129 | partial | Error and request guards exist; Flutter export and async gaps remain. |
| 35 | 130 | partial | Existing offline scripts/CI exist; clean reproducible run outstanding. |
| 36 | 131 | partial | Static liveness is not readiness or monitoring. |
| 37 | 132 | unverified | Provider choice/config documentation is not operational acceptance. |
| 38 | 134 | implemented-source | Digest-only service keys exist; not OAuth client_credentials. |
| 39 | 135 | implemented-source | Stripe adapter and server entitlements source exists; provider acceptance pending. |

## Closure decision

The Gate 1 roadmap requires inventory identity, requirement identity, provenance, explicit qualification state and review-depth caveats. These are reconciled and recorded; outstanding semantic depth is explicitly unresolved rather than silently certified. Recommend closing Gate 1 for evidence reconciliation only, with no claim of exhaustive source review or acceptance. Carry unresolved requirement-specific depth into Gate 6 and defect-specific qualification into Gates 2–5. Gate 2 must establish reproducible offline baseline before repairs. Gate 7 remains separately authorized. No source repairs, manual test dispatch, live tests, merge or deployment performed. Existing offline PR CI may trigger automatically. No existing evidence overwritten.
