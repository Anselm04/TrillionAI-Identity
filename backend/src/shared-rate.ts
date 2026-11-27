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
