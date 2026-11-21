# TrillionAI Identity TypeScript OAuth/OIDC client

This client implements OAuth 2.1 authorization-code **PKCE (S256)** for a **public** third-party application using the Supabase Auth OAuth server. It is not an OAuth authorization server, an OIDC ID-token verifier or a confidential-client credentials manager.

The OAuth client must first be registered **with Supabase Auth**, not merely listed in the Identity developer registry. These are distinct resources until the provider provisioning workflow is implemented.

## Supported workflow

1. Register a redirect URI and public client in Supabase OAuth server configuration. Enable the OAuth server and configure its authorization path.
2. Call `beginAuthorization({issuer:"https://YOUR-PROJECT.supabase.co/auth/v1",clientId:"...",redirectUri:"https://your-app.example/callback"})`.
3. Persist `transaction` under a temporary key scoped to the browser tab (for example, `sessionStorage`, not a shared localStorage key), then navigate to `authorizationUrl`.
4. On the redirect callback, **read and delete** the saved transaction before passing it to `exchangeCallback({callbackUrl:location.href,transaction,expectedIssuer:TRUSTED_ISSUER,expectedClientId:TRUSTED_CLIENT_ID,expectedRedirectUri:TRUSTED_REDIRECT_URI})`. The `TRUSTED_*` values must come from the application deployment configuration, never from the restored transaction or callback URL. This pins the OAuth token destination, public client and redirect URI against tampered browser storage. Deleting it first prevents application-level replay. Do not use the same transaction in more than one request.
5. Only use returned tokens with intended APIs. Validate ID tokens on the server using issuer, audience, signature, expiry and nonce before treating claims as authentication proof. **Do not** accept an OAuth client's token for Identity's privileged management API.

Never embed confidential client secrets in Flutter/browser apps; use a trusted server with proper client authentication. PKCE does not replace client authentication for confidential clients.

Requires modern WebCrypto, an HTTPS origin (except development loopback) and a valid Supabase OAuth server configuration. Live provider configuration and tests have not been performed.

Reference: Supabase OAuth 2.1 Flows — https://supabase.com/docs/guides/auth/oauth-server/oauth-flows
