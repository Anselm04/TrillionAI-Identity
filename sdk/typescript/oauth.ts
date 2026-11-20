/**
 * TrillionAI Identity OAuth 2.1/OIDC public-client helper.
 * Supabase Auth remains the issuer; this package does not mint or verify JWTs.
 * Implements authorization code + S256 PKCE and exact state/callback binding.
 * Requires a secure context with WebCrypto. The caller MUST persist the
 * transaction securely for the duration of the redirect (e.g. sessionStorage)
 * and MUST NOT expose any confidential client secret in browser/mobile code.
 */
export type OAuthTransaction = Readonly<{
  state: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  issuer: string;
  createdAt: number;
}>;

export type OAuthTokens = Readonly<{
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  id_token?: string;
  scope?: string;
}>;

function base64url(bytes: Uint8Array): string {
  const data = Array.from(bytes, x => String.fromCharCode(x)).join("");
  if (typeof btoa !== "function") throw Error("secure_encoding_unavailable");
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function randomString(): string {
  if (!globalThis.crypto?.getRandomValues) throw Error("secure_random_unavailable");
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes);
}
function strictHttps(url: string, allowLoopback = false): URL {
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.hash || parsed.search || parsed.href !== url) throw Error("invalid_oauth_url");
  const loopback = allowLoopback && parsed.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !loopback) throw Error("https_required");
  return parsed;
}
function issuerUrl(input: string): URL {
  const parsed = strictHttps(input.replace(/\/$/, ""));
  // Accept the canonical GoTrue issuer URL, never arbitrary customer endpoints.
  if (parsed.pathname !== "/auth/v1" && parsed.pathname !== "/auth/v1/") throw Error("invalid_issuer_path");
  return parsed;
}
function callbackUri(input: string): URL {
  const uri = new URL(input);
  if (uri.hash || uri.username || uri.password || !["https:","http:"].includes(uri.protocol)) throw Error("invalid_callback");
  if (uri.protocol === "http:" && !["localhost","127.0.0.1","[::1]"].includes(uri.hostname)) throw Error("https_required");
  return uri;
}
export async function beginAuthorization(options: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
}): Promise<{ authorizationUrl: string; transaction: OAuthTransaction }> {
  if (!/^[a-zA-Z0-9._~-]{1,128}$/.test(options.clientId)) throw Error("invalid_client_id");
  const issuer = issuerUrl(options.issuer);
  const callback = callbackUri(options.redirectUri);
  if (callback.href !== options.redirectUri) throw Error("noncanonical_redirect_uri");
  if (!globalThis.crypto?.subtle) throw Error("webcrypto_unavailable");
  const verifier = randomString();
  const state = randomString();
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(hash));
  const authorize = new URL(issuer.href.replace(/\/$/, "") + "/oauth/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", options.clientId);
  authorize.searchParams.set("redirect_uri", options.redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("scope", options.scope ?? "openid email profile");
  return { authorizationUrl: authorize.href, transaction: {
    state, verifier, clientId: options.clientId, redirectUri: options.redirectUri,
    issuer: issuer.href.replace(/\/$/, ""), createdAt: Date.now(),
  } };
}
function oauthResponse(data: unknown): OAuthTokens {
  if (!data || typeof data !== "object") throw Error("invalid_token_response");
  const t = data as Record<string, unknown>;
  if (typeof t.access_token !== "string" || !t.access_token ||
      typeof t.refresh_token !== "string" || !t.refresh_token ||
      typeof t.expires_in !== "number" || !Number.isFinite(t.expires_in) || t.expires_in <= 0 ||
      String(t.token_type).toLowerCase() !== "bearer") throw Error("invalid_token_response");
  if (t.id_token !== undefined && typeof t.id_token !== "string") throw Error("invalid_id_token");
  if (t.scope !== undefined && typeof t.scope !== "string") throw Error("invalid_scope");
  return {access_token:t.access_token,refresh_token:t.refresh_token,
    token_type:"bearer",expires_in:t.expires_in,
    ...(typeof t.id_token==="string"?{id_token:t.id_token}:{}),
    ...(typeof t.scope==="string"?{scope:t.scope}:{})};
}
export async function exchangeCallback(input: {
  callbackUrl: string;
  transaction: OAuthTransaction;
  fetcher?: typeof fetch;
  now?: number;
}): Promise<OAuthTokens> {
  const {transaction:t} = input;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(t.createdAt) || now < t.createdAt || now - t.createdAt > 10 * 60_000) throw Error("oauth_transaction_expired");
  const callback = new URL(input.callbackUrl);
  const allowed = new URL(t.redirectUri);
  if (callback.origin !== allowed.origin || callback.pathname !== allowed.pathname) throw Error("redirect_mismatch");
  // Avoid replacing or silently ignoring query parameters pre-registered on callback.
  for (const [name,value] of allowed.searchParams) {
    if (callback.searchParams.getAll(name).length !== 1 || callback.searchParams.get(name)!==value) throw Error("redirect_mismatch");
  }
  if (callback.searchParams.getAll("state").length !== 1 ||
      callback.searchParams.get("state") !== t.state) throw Error("oauth_state_mismatch");
  if (callback.searchParams.has("error")) throw Error("oauth_authorization_denied");
  const codes = callback.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0]) throw Error("missing_authorization_code");
  const issuer = issuerUrl(t.issuer);
  const tokenEndpoint = new URL(issuer.href.replace(/\/$/, "") + "/oauth/token");
  const response = await (input.fetcher ?? fetch)(tokenEndpoint, {
    method:"POST", redirect:"error", cache:"no-store",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"authorization_code",code:codes[0],
      client_id:t.clientId,redirect_uri:t.redirectUri,code_verifier:t.verifier}),
  });
  if (!response.ok) throw Error("oauth_token_exchange_failed");
  return oauthResponse(await response.json());
}
