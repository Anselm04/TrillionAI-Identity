/** Passwordless email request policy. Uses the existing Supabase Auth provider.
 * This module never creates an account through the passwordless endpoint.
 * Provider delivery errors must not reveal whether an email is registered.
 */
export const passwordlessRequestOptions = (redirectUrl: string) => ({
  shouldCreateUser: false,
  emailRedirectTo: redirectUrl,
} as const);

export function passwordlessDeliveryStatus(error: { status?: number } | null): 202 | 429 | 503 {
  if (!error) return 202;
  if (error.status === 429) return 429;
  // All other provider errors are indistinguishable to the caller.
  return 503;
}
