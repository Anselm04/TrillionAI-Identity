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
  // Reject reserved OAuth response keys at registration, not only at exchange.
  // Otherwise an invalid redirect could be distributed to authorization servers.
  for (const name of ["state", "code", "error", "error_description", "error_uri"]) {
    if (callback.searchParams.has(name)) throw Error("invalid_registered_callback_parameter");
  }
  for (const name of new Set(callback.searchParams.keys())) {
    if (callback.searchParams.getAll(name).length !== 1) throw Error("duplicate_registered_callback_parameter");
  }
  // RFC 6749 section 3.3: scope tokens exclude spaces, quotes and backslashes.
  const scope = options.scope ?? "openid email profile";
  // Bound scope length before building the authorization URL. The grammar is
  // ASCII-only, so string length also bounds its UTF-8 byte length.
  if (scope.length > 1024 || !/^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/.test(scope)) throw Error("invalid_oauth_scope");
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
  authorize.searchParams.set("scope", scope);
  return { authorizationUrl: authorize.href, transaction: {
    state, verifier, clientId: options.clientId, redirectUri: options.redirectUri,
    issuer: issuer.href.replace(/\/$/, ""), createdAt: Date.now(),
  } };
}
function oauthResponse(data: unknown): OAuthTokens {
  if (!data || typeof data !== "object") throw Error("invalid_token_response");
  const t = data as Record<string, unknown>;
  if (typeof t.access_token !== "string" || !t.access_token.trim() || /[\s\x00-\x1f\x7f-\x9f]/u.test(t.access_token) ||
      typeof t.refresh_token !== "string" || !t.refresh_token.trim() || /[\s\x00-\x1f\x7f-\x9f]/u.test(t.refresh_token) ||
      typeof t.expires_in !== "number" || !Number.isSafeInteger(t.expires_in) || t.expires_in <= 0 ||
      typeof t.token_type !== "string" || t.token_type.toLowerCase() !== "bearer") throw Error("invalid_token_response");
  if (t.id_token !== undefined && (typeof t.id_token !== "string" || !t.id_token.trim() || /[\s\x00-\x1f\x7f-\x9f]/u.test(t.id_token))) throw Error("invalid_id_token");
  // Scope returned by the issuer must obey the same RFC 6749 token grammar.
  if (t.scope !== undefined && (typeof t.scope !== "string" || t.scope.length > 1024 ||
      !/^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/.test(t.scope))) throw Error("invalid_scope");
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
  /** Optional cancellation from the hosting application. */
  signal?: AbortSignal;
  /** Trusted issuer configured by the host application, not restored redirect storage. */
  expectedIssuer?: string;
  /** Trusted public client registration identifier. */
  expectedClientId?: string;
  /** Trusted callback URI configured by the host, not persisted redirect state. */
  expectedRedirectUri?: string;
}): Promise<OAuthTokens> {
  const {transaction:t} = input;
  if (!t || typeof t !== "object") throw Error("invalid_oauth_transaction");
  // Persisted redirect transactions are untrusted on restoration.
  // Reject malformed state, verifier and client metadata before network I/O.
  if (typeof t.state !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(t.state) ||
      typeof t.verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(t.verifier) ||
      typeof t.clientId !== "string" || !/^[a-zA-Z0-9._~-]{1,128}$/.test(t.clientId) ||
      typeof t.issuer !== "string" || typeof t.redirectUri !== "string" ||
      typeof t.createdAt !== "number" || !Number.isSafeInteger(t.createdAt) || t.createdAt < 0) throw Error("invalid_oauth_transaction");
  // Restored transactions alone cannot establish issuer/client authenticity.
  // Hosts should pin these values against their trusted application configuration.
  if (input.expectedIssuer !== undefined && issuerUrl(input.expectedIssuer).href.replace(/\/$/, "") !== t.issuer) throw Error("oauth_issuer_mismatch");
  if (input.expectedClientId !== undefined && input.expectedClientId !== t.clientId) throw Error("oauth_client_mismatch");
  if (input.expectedRedirectUri !== undefined && input.expectedRedirectUri !== t.redirectUri) throw Error("oauth_redirect_mismatch");
  const registeredCallback = callbackUri(t.redirectUri);
  if (registeredCallback.href !== t.redirectUri) throw Error("invalid_oauth_transaction");
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0 || now < t.createdAt || now - t.createdAt > 10 * 60_000) throw Error("oauth_transaction_expired");
  // Bound callback input before URL parsing and token endpoint I/O.
  // OAuth authorization codes are short opaque values, not unbounded payloads.
  if (typeof input.callbackUrl !== "string" || input.callbackUrl.length > 8192) throw Error("invalid_oauth_callback_size");
  const callback = new URL(input.callbackUrl);
  const allowed = new URL(t.redirectUri);
  if (callback.hash || callback.username || callback.password || callback.origin !== allowed.origin || callback.pathname !== allowed.pathname) throw Error("redirect_mismatch");
  for (const name of ["state", "code", "error", "error_description", "error_uri"]) {
    if (allowed.searchParams.has(name)) throw Error("invalid_registered_callback_parameter");
  }
  // Restored transactions may predate registration-time validation or be tampered with.
  // Reject duplicate registered keys before any token endpoint request.
  for (const name of new Set(allowed.searchParams.keys())) {
    if (allowed.searchParams.getAll(name).length !== 1) throw Error("duplicate_registered_callback_parameter");
  }
  // Avoid replacing or silently ignoring query parameters pre-registered on callback.
  for (const [name,value] of allowed.searchParams) {
    if (callback.searchParams.getAll(name).length !== 1 || callback.searchParams.get(name)!==value) throw Error("redirect_mismatch");
  }
  // Reject callback parameter pollution rather than silently accepting
  // duplicate codes, error indicators, or unrelated unregistered fields.
  const registered = new Set([...allowed.searchParams.keys()]);
  const permitted = new Set([...registered, "state", "code", "error", "error_description", "error_uri"]);
  for (const name of callback.searchParams.keys()) {
    if (!permitted.has(name)) throw Error("unexpected_oauth_parameter");
  }
  for (const name of ["code", "error", "error_description", "error_uri"]) {
    if (callback.searchParams.getAll(name).length > 1) throw Error("duplicate_oauth_parameter");
  }
  if (callback.searchParams.getAll("state").length !== 1 ||
      callback.searchParams.get("state") !== t.state) throw Error("oauth_state_mismatch");
  // Error metadata without an OAuth error is an ambiguous authorization response.
  if (!callback.searchParams.has("error") &&
      (callback.searchParams.has("error_description") || callback.searchParams.has("error_uri")))
    throw Error("orphan_oauth_error_metadata");
  if (callback.searchParams.has("error") && !callback.searchParams.get("error"))
    throw Error("invalid_oauth_error");
  if (callback.searchParams.has("error") && callback.searchParams.has("code")) throw Error("ambiguous_oauth_response");
  if (callback.searchParams.has("error")) throw Error("oauth_authorization_denied");
  const codes = callback.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096 || !/^[\x21-\x7E]+$/.test(codes[0])) throw Error("invalid_authorization_code");
  const issuer = issuerUrl(t.issuer);
  const tokenEndpoint = new URL(issuer.href.replace(/\/$/, "") + "/oauth/token");
  const response = await (input.fetcher ?? fetch)(tokenEndpoint, {
    method:"POST", redirect:"error", cache:"no-store", signal:input.signal,
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"authorization_code",code:codes[0],
      client_id:t.clientId,redirect_uri:t.redirectUri,code_verifier:t.verifier}),
  });
  if (!response.ok) {
    // Discard an unsuccessful issuer response without buffering untrusted error data.
    // Cancellation is best-effort: preserve the stable exchange failure reason.
    try { await response.body?.cancel(); } catch { /* Ignore cancellation failure. */ }
    throw Error("oauth_token_exchange_failed");
  }
  // Do not parse arbitrarily large untrusted token endpoint responses. OAuth
  // credentials are small; oversized payloads indicate a broken or hostile issuer.
  if (!response.body) throw Error("invalid_token_response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 65536) throw Error("oauth_token_response_too_large");
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    // Abort the unread response body on size or decoding failures so an
    // untrusted issuer cannot continue streaming after rejection.
    try { await reader.cancel(); } catch { /* Preserve the original error. */ }
    throw error;
  } finally {
    reader.releaseLock();
  }
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { throw Error("invalid_token_response"); }
  return oauthResponse(payload);
}

/**
 * Preferred callback entry point for applications with a fixed registration.
 * The expected issuer, client ID, and redirect URI MUST come from trusted
 * application configuration, never from restored redirect/session storage.
 * This binds all three values before any token endpoint network request.
 */
export async function exchangeTrustedCallback(input: {
  callbackUrl: string;
  transaction: OAuthTransaction;
  registration: Readonly<{ issuer: string; clientId: string; redirectUri: string }>;
  fetcher?: typeof fetch;
  now?: number;
  signal?: AbortSignal;
}): Promise<OAuthTokens> {
  if (!input.registration || typeof input.registration !== "object" ||
      typeof input.registration.issuer !== "string" ||
      typeof input.registration.clientId !== "string" ||
      typeof input.registration.redirectUri !== "string") {
    throw Error("invalid_trusted_oauth_registration");
  }
  return exchangeCallback({
    callbackUrl: input.callbackUrl,
    transaction: input.transaction,
    expectedIssuer: input.registration.issuer,
    expectedClientId: input.registration.clientId,
    expectedRedirectUri: input.registration.redirectUri,
    fetcher: input.fetcher,
    now: input.now,
    signal: input.signal,
  });
}

/**
 * Consume a tab-scoped redirect transaction exactly once before token exchange.
 * The host should pass sessionStorage (not localStorage) and a fixed key.
 * This is an application-level replay guard, not a substitute for server-side
 * one-time authorization codes or trusted registration configuration.
 */
export async function exchangeStoredCallback(input: {
  callbackUrl: string;
  registration: Readonly<{ issuer: string; clientId: string; redirectUri: string }>;
  storage: Pick<Storage, "getItem" | "removeItem">;
  storageKey: string;
  fetcher?: typeof fetch;
  now?: number;
  signal?: AbortSignal;
}): Promise<OAuthTokens> {
  if (!input.storage || typeof input.storage.getItem !== "function" ||
      typeof input.storage.removeItem !== "function" ||
      typeof input.storageKey !== "string" || !input.storageKey ||
      input.storageKey.length > 256) throw Error("invalid_oauth_storage");
  // Consume before parsing, validating, or performing any network request.
  const raw = input.storage.getItem(input.storageKey);
  input.storage.removeItem(input.storageKey);
  if (raw === null) throw Error("missing_oauth_transaction");
  // A PKCE transaction is small. Bound untrusted persisted input before JSON parsing.
  if (raw.length > 4096) throw Error("oauth_transaction_too_large");
  let transaction: OAuthTransaction;
  try {
    transaction = JSON.parse(raw) as OAuthTransaction;
  } catch {
    throw Error("invalid_oauth_transaction");
  }
  return exchangeTrustedCallback({
    callbackUrl: input.callbackUrl,
    transaction,
    registration: input.registration,
    fetcher: input.fetcher,
    now: input.now,
    signal: input.signal,
  });
}

/**
 * Begin a redirect flow only after its PKCE transaction is safely persisted.
 * Refuse to overwrite an in-flight authorization in the same tab/key.
 * The caller must navigate to authorizationUrl only after this resolves.
 */
export async function beginStoredAuthorization(input: {
  registration: Readonly<{ issuer: string; clientId: string; redirectUri: string }>;
  storage: Pick<Storage, "getItem" | "setItem">;
  storageKey: string;
  scope?: string;
}): Promise<{ authorizationUrl: string }> {
  if (!input.storage || typeof input.storage.getItem !== "function" ||
      typeof input.storage.setItem !== "function" ||
      typeof input.storageKey !== "string" || !input.storageKey ||
      input.storageKey.length > 256) throw Error("invalid_oauth_storage");
  if (!input.registration || typeof input.registration !== "object") throw Error("invalid_trusted_oauth_registration");
  if (input.storage.getItem(input.storageKey) !== null) throw Error("oauth_transaction_already_pending");
  const { authorizationUrl, transaction } = await beginAuthorization({
    ...input.registration, scope: input.scope,
  });
  // A storage exception must prevent the redirect, never fall back to an
  // authorization request with an unpersisted state/verifier.
  const serialized = JSON.stringify(transaction);
  // Another authorization may have started while WebCrypto was hashing PKCE.
  // Recheck immediately before writing so concurrent starts cannot replace state.
  if (input.storage.getItem(input.storageKey) !== null) throw Error("oauth_transaction_already_pending");
  input.storage.setItem(input.storageKey, serialized);
  // Some storage adapters silently discard writes. Never navigate unless the
  // exact verifier and state can be recovered by the callback handler.
  if (input.storage.getItem(input.storageKey) !== serialized) throw Error("oauth_transaction_not_persisted");
  return { authorizationUrl };
}
