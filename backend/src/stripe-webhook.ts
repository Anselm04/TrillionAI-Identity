import { createHmac, timingSafeEqual } from "node:crypto";
export type StripeEvent = { id:string; type:string; created:number; livemode:boolean; data:{object:Record<string,unknown>} };
export function verifyStripeEvent(raw:Buffer, signature:string, secret:string, now=Date.now()):StripeEvent {
 if(!secret.startsWith("whsec_") || raw.length>262144 || signature.length>4096)throw Error("invalid_webhook");
 const parts=signature.split(",").map(v=>v.trim().split("="));
 const times=parts.filter(p=>p[0]==="t").map(p=>p[1]);
 if(times.length!==1 || !/^\d{1,12}$/.test(times[0]??""))throw Error("invalid_signature");
 const timestamp=Number(times[0]);
 if(Math.abs(Math.floor(now/1000)-timestamp)>300)throw Error("expired_signature");
 const expected=createHmac("sha256",secret).update(times[0]+".").update(raw).digest();
 const valid=parts.some(p=>p[0]==="v1" && /^[a-f0-9]{64}$/i.test(p[1]??"") && timingSafeEqual(expected,Buffer.from(p[1]!,"hex")));
 if(!valid)throw Error("invalid_signature");
 const event=JSON.parse(raw.toString("utf8"));
 if(!event || typeof event.id!=="string" || !/^evt_[A-Za-z0-9]+$/.test(event.id) || typeof event.type!=="string" || !Number.isSafeInteger(event.created) || typeof event.livemode!=="boolean" || !event.data?.object || typeof event.data.object!=="object" || Array.isArray(event.data.object))throw Error("invalid_event");
 return event as StripeEvent;
}
export function subscriptionEvent(event:StripeEvent) {
 if(!["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type))return null;
 const s=event.data.object;
 if(typeof s.id!=="string" || !/^sub_[A-Za-z0-9]+$/.test(s.id) || typeof s.customer!=="string" || !/^cus_[A-Za-z0-9]+$/.test(s.customer) || typeof s.status!=="string")throw Error("invalid_subscription_event");
 return {eventId:event.id,customerId:s.customer,subscriptionId:s.id,eventCreated:event.created,status:s.status,liveMode:event.livemode};
}
