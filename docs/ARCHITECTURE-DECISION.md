# ADR-001: One canonical identity implementation

**Decision:** Use the existing Supabase Auth project for TrillionAI Identity's first production candidate. One backend (Node.js/TypeScript), reusable React and Flutter clients, and Supabase-backed roles and tenant membership. No second upstream authentication authority.

## Superseded alternative
Draft PR #1 introduced Keycloak, additional PostgreSQL, Redis, OIDC/JWKS verification, a Fastify backend and a separate Flutter authorization client. The original proposal is retained in PR #1's branch/history but **must not** be merged or used alongside this implementation. Operating that stack would duplicate authentication, require additional operational expertise, and introduce credential migration.

## Retained intellectual property from PR #1
1. The approved Identity Command Centre UI specification (`docs/APPROVED-IDENTITY-UI.md`).
2. Principle: JWT/identity must be validated server-side before deriving permissions; never trust client-supplied roles.
3. Organisation membership and cross-tenant denial. Adapted to existing Supabase project via `identity_organisations` and `identity_memberships`.
4. CI intent: independent backend/web/Flutter checks; this branch adds a manually dispatchable workflow until GitHub Actions costs and native compilation are approved.

## Non-negotiable boundaries
- User-facing account signup needs verified email, not SMS.
- Owner role is assigned only by an operator after first-party registration, confirmed email and TOTP enrollment. Backend gate requires a valid, recent verified MFA event.
- Product-specific subscription cancellation and data deletion require actual adapters, not no-ops.
- Shared Supabase identity does **not** imply automatic SSO across domains or cross-product deletion completeness.
- AppForge integration is not authorized; keep Fly.io disconnected.
- No production claims until tests and real provider acceptance are evidenced.

## PR consolidation
- PR #2 is the single implementation PR.
- PR #1 is preserved in Git history but superseded/closed rather than merged.
- Do not cherry-pick PR #1's Docker Compose, Keycloak, duplicate login frontend, or incompatible Fastify server.
