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
export const hooks: AppHooks = {};

/** Install only the explicitly configured billing provider. */
export function configureBilling(provider: Pick<AppHooks, "listSubscriptions" | "cancelSubscription">): void {
  hooks.listSubscriptions = provider.listSubscriptions;
  hooks.cancelSubscription = provider.cancelSubscription;
}

