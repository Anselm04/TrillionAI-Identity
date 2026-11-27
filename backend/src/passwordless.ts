/** Passwordless email request policy. Uses the existing Supabase Auth provider.
 * This module never creates an account through the passwordless endpoint.
 * Provider delivery errors must not reveal whether an email is registered.
 */

/** Reject malformed or credential-bearing callback URLs before contacting Auth.
 * A callback must be server-owned; never pass a URL supplied in a request body.
 */
export function passwordlessRequestOptions(redirectUrl: string) {
  const callback = new URL(redirectUrl);
  const local = callback.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(callback.hostname);
  if ((!local && callback.protocol !== "https:") ||
      callback.username || callback.password || callback.hash ||
      callback.search || !callback.hostname) {
    throw new Error("Invalid passwordless callback URL");
  }
  return {
    shouldCreateUser: false,
    emailRedirectTo: callback.href,
  } as const;
}
