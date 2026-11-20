import { admin } from "./supabase.js";
import { hooks } from "./hooks.js";

/** Identity owns these records; external products must register their own
 * cleanup in addition to this implementation, never replace it silently. */
export function initializeAccountLifecycle(): void {
 hooks.exportUserData = async uid => {
   const {data,error}=await admin.rpc("identity_export_billing",{p_user:uid});
   if(error)throw Error("billing_export_unavailable");
   return {billing:data??null,subscriptions:hooks.listSubscriptions?await hooks.listSubscriptions(uid):null};
 };
 hooks.deleteUserData = async uid => {
   // Do not delete the customer mapping or memberships in a separate
   // transaction: a failed auth deletion must preserve the retry evidence.
   const {data,error}=await admin.rpc("identity_deletion_conflicts",{p_user:uid});
   if(error||!Array.isArray(data)||data.length)throw Error("account_cleanup_ownership_conflict");
   // Identity-owned profile, memberships, invitations and mapped customer
   // records are removed atomically by foreign keys on auth.users deletion.
 };
}
