# Identity foundation: status and security boundary

This initial implementation is **not production-ready**.

## Trust model
- Keycloak is the upstream standards-based OIDC authentication authority. Passwords, account verification, passkeys, MFA, social login and recovery are configured and implemented there using supported product capabilities. They are **not yet proven or configured in this repository**.
- The Identity API is a resource server, not a password collector. Its JWT verifier requires issuer, resource audience, permitted asymmetric algorithms and signed token claims.
- Organisation memberships are resolved by the backend from PostgreSQL using the verified OIDC subject. Client-selected organisation IDs are never proof of membership. An unauthorised organisation lookup returns 404.
- Redis is provisioned for future bounded verification state and distributed rate limiting. Current Fastify rate limiting is process-local and must not be treated as distributed protection.
- The current Flutter client does not implement token persistence, renewal or remote logout. Its local token clearing is **not** full logout.

## Local development
1. Set strong local values for POSTGRES_PASSWORD, REDIS_PASSWORD and KEYCLOAK_ADMIN_PASSWORD in a private environment; never commit them.
2. Run `docker compose up -d`. This is development-only: Keycloak uses `start-dev`.
3. Run `backend/sql/001_identity.sql` against the PostgreSQL database using a migration account.
4. In Keycloak, create realm `trillionai-identity`, a public authorization-code client with PKCE S256, exact redirect URIs and the `identity-api` audience mapper. Do **not** enable direct access grants. Configure email and verification policies. Do not use development defaults in production.
5. Set `backend/.env` from example (and do not commit it), then `cd backend && npm install && npm run dev`.
6. Run the Flutter sample with `--dart-define` values for OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI and IDENTITY_API_URL. Mobile platform callback registration and deployment assets are not yet generated.

## Before commercial deployment
Implement database migration runner, production PostgreSQL isolation, secure Keycloak deployment, email/SMS providers, explicit OIDC client provisioning, consent/versioning, durable identity-to-organisation provisioning, security audit write paths, full account lifecycle, WebAuthn/TOTP/recovery policy verification, global rate limits, billing, self-service developer portal and independent penetration testing. Audit dependency versions and pin image digests before release. Do not mark these as complete based on green CI.

## Strict scope
Do not modify or integrate AppForge, Observability or any other TrillionAI product.
