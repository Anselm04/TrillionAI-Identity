import { credentialIssueInput, issueServiceKey, digestServiceKey } from "./service-credentials.js";
import { developerClientInput } from "./developer-client.js";
import { createCheckoutProvider, parseCheckoutPlans } from "./stripe-checkout.js";
import { initializeAccountLifecycle } from "./account-lifecycle.js";
import { verifyStripeEvent, subscriptionEvent } from "./stripe-webhook.js";
import { issueInvitation, invitationDigest } from "./invitations.js";
import { collectPages } from "./pagination.js";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "./config.js";
import { admin, publicAuthClient } from "./supabase.js";
import { guard, type AuthRequest } from "./guards.js";
import { hooks } from "./hooks.js";
import { initializeStripeBilling } from "./stripe-bootstrap.js";
import { cancelDirectSubscriptionVerified, BillingVerificationError } from "./billing.js";
import { directBillingIsCancelled, storeSubscriptionsRequireAcknowledgement } from "./deletion.js";

export const app = express();
app.disable("x-powered-by");
if(config.TRUST_PROXY_HOPS>0)app.set("trust proxy",config.TRUST_PROXY_HOPS);
app.use(helmet());
const allowedOrigins = new Set([new URL(config.APP_URL).origin,
  ...(config.ALLOWED_ORIGINS ?? "").split(",").map(s=>s.trim()).filter(Boolean)]);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.has(origin)) callback(null, true);
  else callback(new Error("origin_not_allowed"));
}, credentials: false }));
app.post("/webhooks/stripe",express.raw({type:"application/json",limit:"256kb"}),wrap(async(req,res)=>{
 const secret=process.env.STRIPE_WEBHOOK_SECRET?.trim();
 if(!secret){res.status(503).json({error:"webhook_not_configured"});return;}
 let event;
 try {
  if(!Buffer.isBuffer(req.body))throw Error("invalid_body");
  event=verifyStripeEvent(req.body,req.header("stripe-signature")??"",secret);
 } catch {res.status(400).json({error:"invalid_webhook"});return;}
 const mode=process.env.STRIPE_EVENT_MODE;
 if(!["test","live"].includes(mode??"") || event.livemode!==(mode==="live")){res.status(400).json({error:"webhook_mode_mismatch"});return;}
 let record;
 try {record=subscriptionEvent(event);} catch {res.status(400).json({error:"invalid_event"});return;}
 if(!record){res.json({received:true});return;}
 const {error}=await admin.from("identity_stripe_events").insert({
  event_id:record.eventId,customer_id:record.customerId,subscription_id:record.subscriptionId,
  event_created:record.eventCreated,status:record.status,live_mode:record.liveMode
 });
 if(error&&error.code!=="23505"){res.status(503).json({error:"webhook_storage_unavailable"});return;}
 res.json({received:true});
}));
app.use(express.json({ limit: "16kb" }));
app.use((_, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const password = z.string().min(12).max(128);
function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
}
const principal = (req: Request) => (req as AuthRequest).principal!;
const neutral = { message: "If this address is eligible, an email has been requested." };
async function audit(action: string, uid?: string) {
  const { error } = await admin.from("identity_audit_log").insert({ user_id: uid ?? null, action });
  if (error) console.error("Identity audit write failed:", action);
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.post("/auth/register", limiter, wrap(async (req, res) => {
  const v = z.object({ email, password }).safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: "Use a valid email and password of at least 12 characters." }); return; }
  const { error } = await publicAuthClient().auth.signUp({ ...v.data, options: { emailRedirectTo: new URL("/verified", config.APP_URL).href } });
  if (error) {
    res.status(error.status === 429 ? 429 : 503).json({
      error: error.status === 429 ? "too_many_requests" : "registration_unavailable",
    }); return;
  }
  res.status(202).json(neutral);
}));
app.post("/auth/resend", limiter, wrap(async (req, res) => {
  const v = z.object({ email }).safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: "Valid email required" }); return; }
  const { error } = await publicAuthClient().auth.resend({ email: v.data.email, type: "signup", options: { emailRedirectTo: new URL("/verified", config.APP_URL).href } });
  if (error) {
    if (["user_not_found", "email_not_found", "email_already_confirmed"].includes(error.code ?? "")) {
      res.status(202).json(neutral); return;
    }
    res.status(error.status === 429 ? 429 : 503).json({ error: "verification_delivery_unavailable" }); return;
  }
  res.status(202).json(neutral);
}));
app.post("/auth/forgot", limiter, wrap(async (req, res) => {
  const v = z.object({ email }).safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: "Valid email required" }); return; }
  const { error } = await publicAuthClient().auth.resetPasswordForEmail(v.data.email, { redirectTo: new URL("/reset", config.APP_URL).href });
  if (error) {
    if (["user_not_found", "email_not_found"].includes(error.code ?? "")) {
      res.status(202).json(neutral); return;
    }
    res.status(error.status === 429 ? 429 : 503).json({ error: "recovery_delivery_unavailable" }); return;
  }
  res.status(202).json(neutral);
}));
app.post("/auth/login", limiter, wrap(async (req, res) => {
  const v = z.object({ email, password: z.string().max(128) }).safeParse(req.body);
  if (!v.success) { res.status(401).json({ error: "Invalid credentials" }); return; }
  const { data, error } = await publicAuthClient().auth.signInWithPassword(v.data);
  if (error?.status === 429) { res.status(429).json({ error: "too_many_requests" }); return; }
  if (error && (error.status ?? 0) >= 500) { res.status(503).json({ error: "authentication_unavailable" }); return; }
  if (error || !data.session) {
    res.status(error?.code === "email_not_confirmed" ? 403 : 401).json({
      error: error?.code === "email_not_confirmed" ? "email_not_confirmed" : "invalid_credentials",
    }); return;
  }
  if (!data.user?.email_confirmed_at) {
    res.status(403).json({ error: "email_not_confirmed" }); return;
  }
  await audit("login", data.user.id);
  res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at });
}));
app.post("/auth/refresh", limiter, wrap(async (req, res) => {
  const v = z.object({ refresh_token: z.string().min(20) }).safeParse(req.body);
  if (!v.success) { res.status(401).json({ error: "session_expired" }); return; }
  const { data, error } = await publicAuthClient().auth.refreshSession({ refresh_token: v.data.refresh_token });
  if (error?.status && error.status >= 500) { res.status(503).json({ error: "authentication_unavailable" }); return; }
  if (error || !data.session || !data.user?.email_confirmed_at) { res.status(401).json({ error: "session_expired" }); return; }
  res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at });
}));
app.post("/auth/logout", guard("customer", true), wrap(async (req, res) => {
  const parsed = z.object({ scope: z.enum(["local", "global", "others"]).default("local") }).safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "invalid_logout_scope" }); return; }
  const response = await fetch(`${config.SUPABASE_URL}/auth/v1/logout?scope=${parsed.data.scope}`, {
    method: "POST", headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${principal(req).token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) { res.status(502).json({ error: "logout_not_confirmed" }); return; }
  await audit("logout", principal(req).uid);
  res.json({ message: parsed.data.scope === "others" ? "Other sessions signed out" : "Signed out", scope: parsed.data.scope });
}));
app.post("/auth/change-password", guard(), limiter, wrap(async (req, res) => {
  const valid = z.object({ current_password: z.string().min(1).max(128),
    new_password: password }).safeParse(req.body);
  if (!valid.success) { res.status(400).json({ error: "A current password and a new 12+ character password are required" }); return; }
  const p = principal(req);
  const temporary = await publicAuthClient().auth.signInWithPassword({
    email: p.email, password: valid.data.current_password,
  });
  if (temporary.error || !temporary.data.session?.access_token ||
      temporary.data.user.id !== p.uid) {
    res.status(401).json({ error: "current_password_invalid" }); return;
  }
  // Terminate the authentication session created solely to check the current password.
  const tempLogout = await fetch(`${config.SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${temporary.data.session.access_token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!tempLogout.ok) { res.status(502).json({ error: "reauthentication_cleanup_failed" }); return; }
  const { error } = await admin.auth.admin.updateUserById(p.uid, {
    password: valid.data.new_password,
  });
  if (error) { res.status(503).json({ error: "password_not_updated" }); return; }
  const logout = await fetch(`${config.SUPABASE_URL}/auth/v1/logout?scope=global`, {
    method: "POST",
    headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${p.token}` },
    signal: AbortSignal.timeout(8000),
  });
  await audit("password_changed", p.uid);
  if (!logout.ok) { res.status(502).json({ error: "password_changed_session_revoke_unconfirmed" }); return; }
  res.json({ updated: true, signedOut: true });
}));
app.get("/me", guard("customer", true), (req, res) => {
  const p = principal(req);
  if (p.totpFactorId && p.aal !== "aal2") {
    res.json({ mfa_required: true, mfa_factor_id: p.totpFactorId }); return;
  }
  res.json({ id: p.uid, email: p.email, role: p.role, mfa_enabled: Boolean(p.totpFactorId) });
});
app.get("/account/sessions", guard(), wrap(async (req, res) => {
  const current = principal(req).sessionId;
  if (!current) { res.status(401).json({error:"invalid_session"}); return; }
  const {data,error} = await admin.rpc("identity_list_sessions", {p_user:principal(req).uid,p_current:current});
  if (error || !Array.isArray(data)) { res.status(503).json({error:"sessions_unavailable"}); return; }
  if (!data.some(row => row.current_session === true)) { res.status(401).json({error:"session_revoked"}); return; }
  res.json({sessions:data});
}));
app.delete("/account/sessions/:id", limiter, guard(), wrap(async (req,res) => {
  const current = principal(req).sessionId;
  const target = z.string().uuid().safeParse(req.params.id);
  if (!current) { res.status(401).json({error:"invalid_session"}); return; }
  if (!target.success || target.data === current) { res.status(400).json({error:"invalid_target_session"}); return; }
  const {data,error} = await admin.rpc("identity_revoke_session", {p_user:principal(req).uid,p_current:current,p_target:target.data});
  if (error) { res.status(503).json({error:"session_revocation_unavailable"}); return; }
  if (data !== true) { res.status(404).json({error:"session_not_found"}); return; }
  await audit("session_revoked", principal(req).uid);
  res.status(204).end();
}));
app.get("/account/profile", guard(), wrap(async (req, res) => {
  const { data, error } = await admin.from("identity_profiles").select("display_name").eq("user_id", principal(req).uid).maybeSingle();
  if (error) { res.status(503).json({ error: "profile_unavailable" }); return; }
  res.json({ display_name: data?.display_name ?? "" });
}));
app.patch("/account/profile", limiter, guard(), wrap(async (req, res) => {
  const v = z.object({ display_name: z.string().trim().max(80) }).safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: "Invalid display name" }); return; }
  const { error } = await admin.from("identity_profiles").upsert({ user_id: principal(req).uid, display_name: v.data.display_name });
  if (error) { res.status(503).json({ error: "profile_not_saved" }); return; }
  res.json({ message: "Profile saved" });
}));
app.get("/account/billing/plans",guard(),wrap(async(_req,res)=>{
 const plans=parseCheckoutPlans(process.env.STRIPE_CHECKOUT_PLANS);
 res.json({plans:process.env.STRIPE_SECRET_KEY?plans.map(p=>({id:p.id})):[]});
}));
app.post("/account/billing/checkout",limiter,guard(),wrap(async(req,res)=>{
 const input=z.object({plan:z.string().max(64),attempt:z.string().uuid()}).strict().safeParse(req.body);
 if(!input.success){res.status(400).json({error:"invalid_checkout"});return;}
 const secret=process.env.STRIPE_SECRET_KEY;
 if(!secret||!hooks.listSubscriptions){res.status(503).json({error:"billing_not_connected"});return;}
 const plan=parseCheckoutPlans(process.env.STRIPE_CHECKOUT_PLANS).find(p=>p.id===input.data.plan);
 if(!plan){res.status(404).json({error:"plan_not_found"});return;}
 const uid=principal(req).uid;
 const provider=createCheckoutProvider(secret,config.APP_URL);
 const {data:stored,error:readError}=await admin.from("identity_stripe_customers").select("stripe_customer_id").eq("user_id",uid).maybeSingle();
 if(readError){res.status(503).json({error:"customer_lookup_unavailable"});return;}
 let customer=stored?.stripe_customer_id;
 if(!customer){
  const created=await provider.createCustomer(uid);
  const {error:writeError}=await admin.from("identity_stripe_customers").insert({user_id:uid,stripe_customer_id:created});
  if(writeError&&writeError.code!=="23505"){res.status(503).json({error:"customer_mapping_unavailable"});return;}
  const {data:confirmed,error:confirmError}=await admin.from("identity_stripe_customers").select("stripe_customer_id").eq("user_id",uid).single();
  if(confirmError||!confirmed?.stripe_customer_id){res.status(503).json({error:"customer_mapping_unconfirmed"});return;}
  customer=confirmed.stripe_customer_id;
 }
 if(typeof customer!=="string"){res.status(503).json({error:"customer_mapping_unconfirmed"});return;}
 const subscriptions=await hooks.listSubscriptions(uid);
 if(subscriptions.some(s=>s.status!=="cancelled"||Boolean(s.accessUntil&&Date.parse(s.accessUntil)>Date.now()))){
  res.status(409).json({error:"existing_subscription"});return;
 }
 const url=await provider.checkout(uid,customer,plan,input.data.attempt);
 res.status(201).json({url});
}));
// Entitlements are derived from the authenticated customer's current provider state,
// never from a checkout redirect or a webhook receipt alone.
app.get("/account/deletion-readiness",guard(),wrap(async(req,res)=>{
 const p=principal(req);
 if(p.role!=="customer"){res.status(403).json({error:"privileged_account"});return;}
 const {data,error}=await admin.rpc("identity_deletion_conflicts",{p_user:p.uid});
 if(error||!Array.isArray(data)){res.status(503).json({error:"ownership_check_unavailable"});return;}
 const subscriptions=hooks.listSubscriptions?await hooks.listSubscriptions(p.uid):null;
 res.json({ownershipConflicts:data,billingConnected:subscriptions!==null,storeAcknowledgementRequired:subscriptions===null?null:storeSubscriptionsRequireAcknowledgement(subscriptions),canRequestDeletion:data.length===0&&subscriptions!==null&&Boolean(hooks.deleteUserData&&hooks.cancelSubscription)});
}));
app.get("/account/entitlements",guard(),wrap(async(req,res)=>{
 if(!hooks.listSubscriptions){res.status(503).json({error:"billing_not_connected"});return;}
 const subscriptions=await hooks.listSubscriptions(principal(req).uid);
 const now=Date.now();
 const grants=subscriptions.filter(s=>s.accessUntil!==null && Number.isFinite(Date.parse(s.accessUntil)) && Date.parse(s.accessUntil)>now && (s.status==="active"||s.status==="cancelled")).map(s=>({subscriptionId:s.id,plan:s.plan,accessUntil:s.accessUntil}));
 res.json({active:grants.length>0,grants});
}));
app.get("/account/subscriptions", guard(), wrap(async (req, res) => {
  if (!hooks.listSubscriptions) { res.status(501).json({ error: "billing_not_connected" }); return; }
  res.json({ subscriptions: await hooks.listSubscriptions(principal(req).uid) });
}));
app.post("/account/subscriptions/:id/cancel", limiter, guard(), wrap(async (req, res) => {
  if (!hooks.listSubscriptions || !hooks.cancelSubscription) { res.status(501).json({ error: "billing_not_connected" }); return; }
  const uid = principal(req).uid;
  const current = (await hooks.listSubscriptions(uid)).find(x => x.id === req.params.id);
  if (!current) { res.status(404).json({ error: "subscription_not_found" }); return; }
  if (current.store !== "direct") {
    res.status(409).json({ error: "store_managed_subscription", manageUrl: current.manageUrl }); return;
  }
  try {
    const result = await cancelDirectSubscriptionVerified(hooks, uid, current);
    await audit("subscription_cancelled", uid);
    res.json({ cancelled: true, accessUntil: result.accessUntil });
  } catch (e) {
    res.status(502).json({ error: e instanceof BillingVerificationError
      ? e.code : "cancellation_not_confirmed" });
  }
}));
app.get("/account/export", guard(), wrap(async (req, res) => {
  const p = principal(req);
  const { data, error } = await admin.from("identity_profiles").select("display_name").eq("user_id", p.uid).maybeSingle();
  if (error) { res.status(503).json({ error: "profile_export_unavailable" }); return; }
  const ownMemberships = await collectPages(async after => {
    let query = admin.from("identity_memberships")
      .select("organisation_id,role,status,created_at").eq("user_id", p.uid)
      .order("organisation_id").limit(200);
    if (after !== null) query = query.gt("organisation_id", after);
    const { data, error } = await query;
    if (error || !data) throw new Error("membership_export_unavailable");
    return data;
  }, row => row.organisation_id as string);
  const appData = hooks.exportUserData ? await hooks.exportUserData(p.uid) : {};
  await audit("data_exported", p.uid);
  res.setHeader("Content-Disposition", 'attachment; filename="my-data.json"');
  res.json({ account: { id: p.uid, email: p.email }, profile: data ?? {}, memberships: ownMemberships, app: appData });
}));
app.delete("/account", limiter, guard(), wrap(async (req, res) => {
  const p = principal(req);
  if (p.role !== "customer") { res.status(403).json({ error: "owner_or_admin_delete_requires_privileged_process" }); return; }
  if (!hooks.listSubscriptions || !hooks.cancelSubscription || !hooks.deleteUserData) {
    res.status(501).json({ error: "account_deletion_not_configured" }); return;
  }
  const v = z.object({ password: z.string().min(1).max(128), confirm: z.literal("DELETE"),
    acknowledge_store_subscriptions: z.boolean().default(false) }).safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: "Confirmation and password required" }); return; }
  const { data: reauth, error: passwordError } = await publicAuthClient().auth.signInWithPassword({ email: p.email, password: v.data.password });
  if (passwordError || !reauth.session?.access_token || reauth.user.id !== p.uid) {
    res.status(401).json({ error: "reauthentication_failed" }); return;
  }
  // Revoke the short-lived password-check session so it cannot remain active.
  const revoke = await fetch(`${config.SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${reauth.session.access_token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!revoke.ok) { res.status(502).json({ error: "reauthentication_cleanup_failed" }); return; }
  const {data: conflicts,error: conflictError}=await admin.rpc("identity_deletion_conflicts",{p_user:p.uid});
  if(conflictError || !Array.isArray(conflicts)){res.status(503).json({error:"ownership_check_unavailable"});return;}
  if(conflicts.length){res.status(409).json({error:"transfer_organisation_ownership",organisations:conflicts});return;}
  const subscriptions = await hooks.listSubscriptions(p.uid);
  if (!v.data.acknowledge_store_subscriptions &&
      storeSubscriptionsRequireAcknowledgement(subscriptions)) {
    res.status(409).json({ error: "store_subscription_needs_cancellation",
      manageUrls: subscriptions.filter(x=>x.store!=="direct" && x.status!=="cancelled").map(x=>x.manageUrl) });
    return;
  }
  for (const subscription of subscriptions.filter(x => x.store === "direct" && x.status !== "cancelled")) {
    try {
      await cancelDirectSubscriptionVerified(hooks, p.uid, subscription);
    } catch (e) {
      res.status(502).json({ error: e instanceof BillingVerificationError
        ? e.code : "billing_not_cancelled" }); return;
    }
  }
  const remaining = await hooks.listSubscriptions(p.uid);
  if (!directBillingIsCancelled(remaining)) {
    res.status(502).json({ error: "direct_billing_not_confirmed" }); return;
  }
  // Apple/Google recurring billing must be cancelled in the relevant store.
  // The user may explicitly acknowledge that risk without losing deletion rights.
  // Revoke other sessions before deletion while keeping the current session
  // available for retries if the provider or cleanup fails.
  const otherSessions = await fetch(`${config.SUPABASE_URL}/auth/v1/logout?scope=others`, {
    method: "POST", headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${p.token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!otherSessions.ok) { res.status(502).json({ error: "session_revoke_unconfirmed" }); return; }
  await hooks.deleteUserData(p.uid);
  const { error } = await admin.auth.admin.deleteUser(p.uid);
  if (error) { res.status(502).json({ error: "identity_deletion_not_confirmed" }); return; }
  await audit("account_deleted");
  res.json({ deleted: true });
}));
app.post("/v1/organisations", limiter, guard(), wrap(async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(200) }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid_organisation_name" }); return; }
  const { data, error } = await admin.rpc("identity_create_organisation", {
    p_user_id: principal(req).uid, p_name: parsed.data.name,
  });
  if (error || typeof data !== "string") { res.status(503).json({ error: "organisation_not_created" }); return; }
  res.status(201).json({ organisation: { id: data, name: parsed.data.name }, role: "owner" });
}));
app.get("/v1/organisations", guard(), wrap(async (req, res) => {
  const p = principal(req);
  // Cursor through all memberships; avoid PostgREST's implicit 1,000-row cap
  // and unbounded URL lengths from a single large IN filter.
  const memberships = await collectPages(async after => {
    let query = admin.from("identity_memberships")
      .select("organisation_id,role,status").eq("user_id", p.uid)
      .eq("status", "active").order("organisation_id").limit(200);
    if (after !== null) query = query.gt("organisation_id", after);
    const { data, error } = await query;
    if (error || !data) throw new Error("tenant_memberships_unavailable");
    return data;
  }, row => row.organisation_id as string);
  const organisations: { id: string; name: string; role: string }[] = [];
  for (let offset = 0; offset < memberships.length; offset += 100) {
    const batch = memberships.slice(offset, offset + 100);
    const { data, error } = await admin.from("identity_organisations")
      .select("id,name").in("id", batch.map(m => m.organisation_id));
    if (error || !data) throw new Error("organisations_unavailable");
    const roles = new Map(batch.map(m => [m.organisation_id, m.role]));
    for (const org of data) {
      const role = roles.get(org.id);
      if (role) organisations.push({ id: org.id, name: org.name, role });
    }
  }
  res.json({ organisations });
}));
app.get("/v1/organisations/:id", guard(), wrap(async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) {
    res.status(400).json({ error: "invalid_organisation_id" }); return;
  }
  const p = principal(req);
  const { canAccessOrganisation } = await import("./organisation.js");
  const { data: member, error: memberError } = await admin.from("identity_memberships")
    .select("role,status").eq("organisation_id",req.params.id).eq("user_id",p.uid).maybeSingle();
  if (memberError) { res.status(503).json({ error: "tenant_membership_unavailable" }); return; }
  const role = (member?.role ?? null) as import("./organisation.js").OrganisationRole | null;
  if (!canAccessOrganisation(role,"organisation:read",member?.status ?? null)) {
    res.status(404).json({ error: "not_found" }); return;
  }
  const { data: org, error } = await admin.from("identity_organisations")
    .select("id,name").eq("id",req.params.id).maybeSingle();
  if (error) { res.status(503).json({ error: "organisation_unavailable" }); return; }
  if (!org) { res.status(404).json({ error: "not_found" }); return; }
  res.json({ organisation:org,role });
}));
// Tenant mutation authorization is checked again inside the serialized RPC.
async function changeMembership(req: Request,res: Response,remove: boolean) {
  const ids=z.object({id:z.string().uuid(),userId:z.string().uuid()}).safeParse(req.params);
  const body=z.object({role:z.enum(["owner","admin","staff","customer"]),status:z.enum(["active","suspended"])}).strict().safeParse(req.body);
  if (!ids.success || (!remove && !body.success)) { res.status(400).json({error:"invalid_membership"});return; }
  const {data,error}=await admin.rpc("identity_change_membership",{
    p_actor:principal(req).uid,p_org:ids.data.id,p_target:ids.data.userId,
    p_role:!remove&&body.success?body.data.role:null,p_status:!remove&&body.success?body.data.status:null,p_remove:remove
  });
  if(error){res.status(error.code==="23514"?409:503).json({error:error.code==="23514"?"last_active_owner":"membership_change_failed"});return;}
  if(data==="ok"){res.status(204).end();return;}
  const status=data==="not_found"?404:data==="forbidden"?403:data==="invitation_pending"?409:400;
  res.status(status).json({error:data==="not_found"?"not_found":data==="forbidden"?"forbidden":data==="invitation_pending"?"invitation_pending":"invalid_membership"});
}
app.patch("/v1/organisations/:id/members/:userId",limiter,guard(),wrap((req,res)=>changeMembership(req,res,false)));
app.delete("/v1/organisations/:id/members/:userId",limiter,guard(),wrap((req,res)=>changeMembership(req,res,true)));
// Reads perform membership authorization and data selection in the same SQL statement.
app.get("/v1/organisations/:id/members",guard(),wrap(async(req,res)=>{
 const org=z.string().uuid().safeParse(req.params.id);
 const cursor=z.object({after:z.string().uuid().optional()}).strict().safeParse(req.query);
 if(!org.success||!cursor.success){res.status(400).json({error:"invalid_query"});return;}
 const {data,error}=await admin.rpc("identity_list_members",{p_actor:principal(req).uid,p_org:org.data,p_after:cursor.data.after??null});
 if(error||!data){res.status(503).json({error:"members_unavailable"});return;}
 if(data.denied===true){res.status(404).json({error:"not_found"});return;}
 res.json(data);
}));
app.get("/v1/organisations/:id/invitations",guard(),wrap(async(req,res)=>{
 const org=z.string().uuid().safeParse(req.params.id);
 const cursor=z.object({after:z.string().uuid().optional()}).strict().safeParse(req.query);
 if(!org.success||!cursor.success){res.status(400).json({error:"invalid_query"});return;}
 const {data,error}=await admin.rpc("identity_list_invitations",{p_actor:principal(req).uid,p_org:org.data,p_after:cursor.data.after??null});
 if(error||!data){res.status(503).json({error:"invitations_unavailable"});return;}
 if(data.denied===true){res.status(404).json({error:"not_found"});return;}
 res.json(data);
}));
app.post("/v1/organisations/:id/invitations", limiter, guard(), wrap(async (req,res)=>{
  const org=z.string().uuid().safeParse(req.params.id);
  const input=z.object({email,role:z.enum(["admin","staff","customer"])}).strict().safeParse(req.body);
  if(!org.success||!input.success){res.status(400).json({error:"invalid_invitation"});return;}
  const invite=issueInvitation();
  const {data,error}=await admin.rpc("identity_issue_invitation",{p_actor:principal(req).uid,p_org:org.data,p_email:input.data.email,p_role:input.data.role,p_digest:invite.digest,p_expires:invite.expiresAt});
  if(error){res.status(503).json({error:"invitation_unavailable"});return;}
  if(typeof data!=="string"){res.status(404).json({error:"not_found"});return;}
  await audit("invitation_created",principal(req).uid);
  res.status(201).json({id:data,token:invite.token,expiresAt:invite.expiresAt});
}));
app.post("/v1/invitations/accept",limiter,guard(),wrap(async(req,res)=>{
  const input=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().safeParse(req.body);
  if(!input.success){res.status(400).json({error:"invalid_invitation"});return;}
  const p=principal(req);
  const {data,error}=await admin.rpc("identity_accept_invitation",{p_actor:p.uid,p_email:p.email,p_digest:invitationDigest(input.data.token)});
  if(error){res.status(503).json({error:"invitation_unavailable"});return;}
  if(typeof data!=="string"){res.status(404).json({error:"invitation_not_available"});return;}
  res.json({organisation_id:data});
}));
app.delete("/v1/organisations/:id/invitations/:inviteId",limiter,guard(),wrap(async(req,res)=>{
  const ids=z.object({id:z.string().uuid(),inviteId:z.string().uuid()}).safeParse(req.params);
  if(!ids.success){res.status(400).json({error:"invalid_invitation"});return;}
  const {data,error}=await admin.rpc("identity_revoke_invitation",{p_actor:principal(req).uid,p_org:ids.data.id,p_invite:ids.data.inviteId});
  if(error){res.status(503).json({error:"invitation_unavailable"});return;}
  if(data!==true){res.status(404).json({error:"not_found"});return;}
  await audit("invitation_revoked",principal(req).uid);
  res.status(204).end();
}));
app.post("/v1/organisations/:id/clients",limiter,guard(),wrap(async(req,res)=>{
 const org=z.string().uuid().safeParse(req.params.id);
 const input=developerClientInput.safeParse(req.body);
 if(!org.success||!input.success){res.status(400).json({error:"invalid_client_metadata"});return;}
 const {data,error}=await admin.rpc("identity_register_client",{p_actor:principal(req).uid,p_org:org.data,p_name:input.data.name,p_type:input.data.client_type,p_redirects:input.data.redirect_uris});
 if(error){res.status(503).json({error:"client_registration_unavailable"});return;}
 if(typeof data!=="string"){res.status(404).json({error:"not_found"});return;}
 res.status(201).json({id:data,...input.data});
}));
app.get("/v1/organisations/:id/clients",guard(),wrap(async(req,res)=>{
 const org=z.string().uuid().safeParse(req.params.id);
 const cursor=z.object({after:z.string().uuid().optional()}).strict().safeParse(req.query);
 if(!org.success||!cursor.success){res.status(400).json({error:"invalid_query"});return;}
 const {data,error}=await admin.rpc("identity_list_clients",{p_actor:principal(req).uid,p_org:org.data,p_after:cursor.data.after??null});
 if(error){res.status(503).json({error:"clients_unavailable"});return;}
 if(!data){res.status(404).json({error:"not_found"});return;}
 res.json(data);
}));
app.delete("/v1/organisations/:id/clients/:clientId",limiter,guard(),wrap(async(req,res)=>{
 const ids=z.object({id:z.string().uuid(),clientId:z.string().uuid()}).safeParse(req.params);
 if(!ids.success){res.status(400).json({error:"invalid_client"});return;}
 const {data,error}=await admin.rpc("identity_revoke_client",{p_actor:principal(req).uid,p_org:ids.data.id,p_client:ids.data.clientId});
 if(error){res.status(503).json({error:"client_revocation_unavailable"});return;}
 if(data!==true){res.status(404).json({error:"not_found"});return;}
 res.status(204).end();
}));
// Service credentials are opaque API keys, NOT OAuth client credentials/JWTs.
// Their only granted scope is the dedicated service introspection endpoint.
app.post("/v1/organisations/:id/clients/:clientId/credentials",limiter,guard(),wrap(async(req,res)=>{
 const ids=z.object({id:z.string().uuid(),clientId:z.string().uuid()}).safeParse(req.params);
 const input=credentialIssueInput.safeParse(req.body);
 if(!ids.success||!input.success){res.status(400).json({error:"invalid_credential_request"});return;}
 const key=issueServiceKey(Date.now(),input.data.expires_in_days);
 const {data,error}=await admin.rpc("identity_issue_service_credential",{
  p_actor:principal(req).uid,p_org:ids.data.id,p_client:ids.data.clientId,
  p_name:input.data.name,p_digest:key.digest,p_hint:key.secret.slice(0,15),
  p_scopes:input.data.scopes,p_expires:key.expiresAt
 });
 if(error){res.status(error.code==="23514"?409:503).json({error:error.code==="23514"?"credential_limit_reached":"credential_issue_unavailable"});return;}
 if(typeof data!=="string"){res.status(404).json({error:"not_found_or_public_client"});return;}
 res.status(201).json({id:data,name:input.data.name,secret:key.secret,scopes:input.data.scopes,expires_at:key.expiresAt,one_time_display:true});
}));
app.get("/v1/organisations/:id/clients/:clientId/credentials",guard(),wrap(async(req,res)=>{
 const ids=z.object({id:z.string().uuid(),clientId:z.string().uuid()}).safeParse(req.params);
 const cursor=z.object({after:z.string().uuid().optional()}).strict().safeParse(req.query);
 if(!ids.success||!cursor.success){res.status(400).json({error:"invalid_query"});return;}
 const {data,error}=await admin.rpc("identity_list_service_credentials",{
  p_actor:principal(req).uid,p_org:ids.data.id,p_client:ids.data.clientId,p_after:cursor.data.after??null
 });
 if(error){res.status(503).json({error:"credentials_unavailable"});return;}
 if(!data){res.status(404).json({error:"not_found"});return;}
 res.json(data);
}));
app.delete("/v1/organisations/:id/clients/:clientId/credentials/:credentialId",limiter,guard(),wrap(async(req,res)=>{
 const ids=z.object({id:z.string().uuid(),clientId:z.string().uuid(),credentialId:z.string().uuid()}).safeParse(req.params);
 if(!ids.success){res.status(400).json({error:"invalid_credential"});return;}
 const {data,error}=await admin.rpc("identity_revoke_service_credential",{
  p_actor:principal(req).uid,p_org:ids.data.id,p_client:ids.data.clientId,p_credential:ids.data.credentialId
 });
 if(error){res.status(503).json({error:"credential_revocation_unavailable"});return;}
 if(data!==true){res.status(404).json({error:"not_found"});return;}
 res.status(204).end();
}));
app.post("/v1/service-credentials/introspect",limiter,wrap(async(req,res)=>{
 const header=req.header("authorization")??"";
 const match=/^Bearer (tai_sk_[0-9a-f]{64})$/.exec(header);
 if(!match){res.status(401).json({error:"invalid_service_credential"});return;}
 const {data,error}=await admin.rpc("identity_introspect_service_credential",{p_digest:digestServiceKey(match[1])});
 if(error){res.status(503).json({error:"credential_validation_unavailable"});return;}
 if(!data){res.status(401).json({error:"invalid_service_credential"});return;}
 res.json({active:true,...data});
}));
app.get("/owner/ping", guard("owner"), (_req, res) => res.json({ ok: true }));
app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: "internal_error" });
});
if (process.env.NODE_ENV !== "test") initializeStripeBilling(process.env.STRIPE_SECRET_KEY);
if (process.env.NODE_ENV !== "test") initializeAccountLifecycle();
if (process.env.NODE_ENV !== "test") app.listen(config.PORT, () => console.info(`Identity API listening on ${config.PORT}`));
