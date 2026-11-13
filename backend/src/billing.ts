import type { AppHooks, CancellationResult, Subscription } from "./hooks.js";

export class BillingVerificationError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = "BillingVerificationError"; }
}

/** Never treat a provider acknowledgement alone as evidence billing stopped. */
export async function cancelDirectSubscriptionVerified(
  hooks: AppHooks, userId: string, subscription: Subscription
): Promise<CancellationResult> {
  if (!hooks.listSubscriptions || !hooks.cancelSubscription) {
    throw new BillingVerificationError("billing_not_connected");
  }
  if (subscription.store !== "direct") {
    throw new BillingVerificationError("store_managed_subscription");
  }
  let cancellation: CancellationResult;
  try {
    cancellation = await hooks.cancelSubscription(userId, subscription.id);
  } catch {
    throw new BillingVerificationError("provider_cancel_failed");
  }
  if (cancellation.cancelled !== true) {
    throw new BillingVerificationError("provider_cancel_unconfirmed");
  }
  let verified: Subscription | undefined;
  try {
    verified = (await hooks.listSubscriptions(userId)).find(s => s.id === subscription.id);
  } catch {
    throw new BillingVerificationError("billing_recheck_failed");
  }
  if (verified?.status !== "cancelled") {
    throw new BillingVerificationError("billing_status_not_cancelled");
  }
  return cancellation;
}
