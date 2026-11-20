# TrillionAI Identity service credentials

Service credentials are high-entropy, server-to-server opaque API keys for
**confidential** developer applications. They are **not OAuth client secrets,
OAuth access tokens, or a substitute for OAuth client_credentials**.

## Issue and revoke

An authenticated owner or active organisation administrator can call:

- `POST /v1/organisations/:id/clients/:clientId/credentials`
  with `{"name":"production worker","expires_in_days":30,"scopes":["identity:service:read"]}`.
  The response reveals the key **once**. Only confidential, non-revoked
  applications can receive credentials. The limit is 20 simultaneously active
  keys per application, maximum 90-day lifetime.
- `GET /v1/organisations/:id/clients/:clientId/credentials`
  to list non-secret metadata with a cursor.
- `DELETE /v1/organisations/:id/clients/:clientId/credentials/:credentialId`
  to revoke a specific key immediately.

The existing Node.js authenticated guard enforces verified user sessions and
organisation membership is checked again inside the database RPC with the
organisation row locked for serialisation. A revoked developer application
immediately invalidates all its keys. Only SHA-256 digests of cryptographically
random 256-bit secrets are stored, never the plaintext credential.

## Service validation

Trusted server consumers use
`POST /v1/service-credentials/introspect`
with `Authorization: Bearer tai_sk_...` and **no request body**.
A valid, unexpired, non-revoked key returns its organisation, application,
credential ID, and the `identity:service:read` scope. Invalid keys return
401. Database failures fail closed with 503.

The introspection endpoint is an identity lookup, **not authorization for
arbitrary application APIs**. A consumer must restrict operations by both
tenant ID and scope. Do not grant privileged Identity management endpoints to
service keys or accept service keys as end-user sessions. Identity never uses
these secrets to issue OAuth/OIDC tokens.

## Operational requirements

Keep service keys only in backend secret managers, never browser bundles,
Flutter app packages, chat logs or public repositories. Provision
`supabase/migrations/20261120000004_identity_service_credentials.sql` through
the normal controlled migration workflow; merely merging this file does not
apply schema changes to a database.

Rotate keys by generating a replacement, updating the consuming service, and
revoking the old key. Revocation takes effect on the next introspection; any
consumer caching the result must implement strict short caching or no cache.

The current endpoint uses the existing Express in-memory rate limiter and
must be protected by distributed rate limiting before horizontal production
scale. No live database, payment, test or deployment operations were performed
as part of the source integration.
