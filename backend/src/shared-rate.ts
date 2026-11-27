import {createHmac} from "node:crypto";
export type RateDecision={allowed:boolean;remaining:number;reset_epoch:number};
export function rateKey(secret:string,ip:string):string {
 if(secret.length<32||!ip||ip.length>128)throw Error("invalid_rate_identity");
 return createHmac("sha256",secret).update("identity:ip:v1:"+ip).digest("hex");
}
export function parseRateDecision(value:unknown):RateDecision|null {
 if(!value||typeof value!=="object")return null;
 const v=value as Record<string,unknown>;
 if(typeof v.allowed!=="boolean"||typeof v.remaining!=="number"||!Number.isInteger(v.remaining)||v.remaining<0||v.remaining>19||(!v.allowed&&v.remaining!==0)||typeof v.reset_epoch!=="number"||!Number.isSafeInteger(v.reset_epoch)||v.reset_epoch<=0)return null;
 return {allowed:v.allowed,remaining:v.remaining,reset_epoch:v.reset_epoch};
}
export function createSharedRateCheck(hit:(key:string,signal:AbortSignal)=>Promise<unknown>,maxActive=32,timeoutMs=2000){
 if(!Number.isSafeInteger(maxActive)||maxActive<1||!Number.isSafeInteger(timeoutMs)||timeoutMs<1)throw Error("invalid_rate_configuration");
 let active=0;
 return async(key:string):Promise<RateDecision|null>=>{
  if(active>=maxActive)return null;
  active++;
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  let expired=false;
  const timeout=new Promise<null>(resolve=>{timer=setTimeout(()=>{expired=true;resolve(null);controller.abort();},timeoutMs);});
  const work=Promise.resolve().then(()=>hit(key,controller.signal)).then(v=>expired?null:parseRateDecision(v),()=>null).finally(()=>{clearTimeout(timer);active--;});
  return Promise.race([timeout,work]);
 };
}

/** Retain the legacy shared quota while introducing the rolling quota.
 * Both decisions must explicitly allow the request; no retry on ambiguous writes.
 * The caller supplies one deadline and one concurrency slot for the pair. */
export async function enforceCombinedRate(
 key:string,signal:AbortSignal,
 fixed:(key:string,signal:AbortSignal)=>Promise<unknown>,
 rolling:(key:string,signal:AbortSignal)=>Promise<unknown>
):Promise<RateDecision|null>{
 if(signal.aborted)return null;
 const first=parseRateDecision(await fixed(key,signal));
 if(signal.aborted||!first)return null;
 if(!first.allowed)return first;
 const second=parseRateDecision(await rolling(key,signal));
 if(signal.aborted||!second)return null;
 return {allowed:second.allowed,remaining:Math.min(first.remaining,second.remaining),
 reset_epoch:second.allowed?Math.max(first.reset_epoch,second.reset_epoch):second.reset_epoch};
}

export type AccountRateScope="login"|"email-delivery";
/** Address is validated by the same schema used for provider requests.
 * Separate namespaces prevent email delivery from exhausting login quota.
 * Login is source-bound: an unrelated network cannot exhaust a global login bucket.
 * Delivery retains a target-wide anti-flood bucket; suppression is temporary.
 * These are abuse buckets, not authenticated identities. */
export function accountRateKey(secret:string,scope:AccountRateScope,email:string,source?:string):string {
 const normalized=email.trim().toLowerCase();
 if(secret.length<32||!["login","email-delivery"].includes(scope)||!normalized||normalized.length>254)throw Error("invalid_account_rate_identity");
 if(scope==="login"&&(!source||source.length>128))throw Error("invalid_login_source");
 return createHmac("sha256",secret).update(JSON.stringify(["identity:account:v2",scope,normalized,scope==="login"?source:null])).digest("hex");
}
export function accountRateOutcome(scope:AccountRateScope,decision:RateDecision|null):"allow"|"unavailable"|"neutral"|"limited"{
 if(!decision)return "unavailable";
 if(decision.allowed)return "allow";
 return scope==="email-delivery"?"neutral":"limited";
}

/** Only use identifiers returned by the authoritative credential validator. */
export function serviceRateKey(secret:string,credentialId:unknown):string {
 if(secret.length<32||typeof credentialId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(credentialId))throw Error("invalid_service_rate_identity");
 return createHmac("sha256",secret).update(JSON.stringify(["identity:service:introspection:v1",credentialId.toLowerCase()])).digest("hex");
}
export async function verifiedServiceQuota(secret:string,data:unknown,check:(key:string)=>Promise<RateDecision|null>):Promise<RateDecision|null>{
 if(!data||typeof data!=="object")return null;
 try{return parseRateDecision(await check(serviceRateKey(secret,(data as Record<string,unknown>).credential_id)));}
 catch{return null;}
}
