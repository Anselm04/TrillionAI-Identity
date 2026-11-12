import type { Subscription } from "./hooks.js";
export function storeSubscriptionsRequireAcknowledgement(subscriptions: Subscription[]): boolean {
  return subscriptions.some(s => s.store !== "direct" && s.status !== "cancelled");
}
export function directBillingIsCancelled(subscriptions: Subscription[]): boolean {
  return subscriptions.every(s => s.store !== "direct" || s.status === "cancelled");
}
