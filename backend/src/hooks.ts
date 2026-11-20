import { admin } from "./supabase.js";
import { createStripeBilling } from "./stripe-billing.js";
export type Subscription = {
  id: string; plan: string; amountLabel: string; renewsAt: string | null;
  accessUntil: string | null; status: "active" | "cancelled" | "past_due";
  store: "direct" | "apple" | "google"; manageUrl?: string;
};
export type CancellationResult = { cancelled: boolean; accessUntil: string | null };
export interface AppHooks {
  listSubscriptions?(userId: string): Promise<Subscription[]>;
  cancelSubscription?(userId: string, subscriptionId: string): Promise<CancellationResult>;
  exportUserData?(userId: string): Promise<Record<string, unknown>>;
  deleteUserData?(userId: string): Promise<void>;
}
/** The host product must inject REAL, verified implementations; unconfigured
 * hooks do NOT report cancellation or account deletion success. */
const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
export const hooks: AppHooks = stripeSecret ? createStripeBilling(stripeSecret, async (uid) => {
  const {data,error} = await admin.from("identity_stripe_customers")
    .select("stripe_customer_id").eq("user_id",uid).maybeSingle();
  if(error)throw Error("billing_customer_lookup_failed");
  return data?.stripe_customer_id ?? null;
}) : {};

/** Install only the explicitly configured billing provider. */
export function configureBilling(provider: Pick<AppHooks, "listSubscriptions" | "cancelSubscription">): void {
  hooks.listSubscriptions = provider.listSubscriptions;
  hooks.cancelSubscription = provider.cancelSubscription;
}

