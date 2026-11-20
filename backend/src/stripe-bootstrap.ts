import { admin } from "./supabase.js";
import { configureBilling } from "./hooks.js";
import { createStripeBilling } from "./stripe-billing.js";

export function initializeStripeBilling(secret: string | undefined): void {
  if (!secret) return;
  if (!/^(sk|rk)_(test|live)_/.test(secret)) throw Error("Invalid Stripe server credential");
  configureBilling(createStripeBilling(secret, async uid => {
    const { data, error } = await admin.from("identity_stripe_customers")
      .select("stripe_customer_id").eq("user_id", uid).maybeSingle();
    if (error) throw Error("billing_customer_lookup_failed");
    return data?.stripe_customer_id ?? null;
  }));
}
