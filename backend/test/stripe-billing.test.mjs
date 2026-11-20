import test from "node:test";
import assert from "node:assert/strict";
import { createStripeBilling,mapStripeSubscription } from "../src/stripe-billing.ts";
const base={id:"sub_123",customer:"cus_123",status:"active",cancel_at_period_end:false,current_period_end:1900000000,items:{has_more:false,data:[{price:{unit_amount:4900,currency:"usd",recurring:{interval:"month",interval_count:1}}}]}};
const response=x=>new Response(JSON.stringify(x),{status:200});
test("maps active and scheduled cancellation without losing expiry",()=>{
 assert.equal(mapStripeSubscription(base).status,"active");
 const cancelled=mapStripeSubscription({...base,cancel_at_period_end:true});
 assert.equal(cancelled.status,"cancelled");assert.equal(cancelled.renewsAt,null);assert.equal(cancelled.accessUntil,new Date(1900000000000).toISOString());
});
test("rejects cancellation across customer boundaries before mutation",async()=>{
 let mutations=0;
 const hooks=createStripeBilling("sk_test_mock",async()=>"cus_other",async(_url,opts)=>{if(opts.method==="POST")mutations++;return response(base);});
 await assert.rejects(hooks.cancelSubscription("user","sub_123"),/subscription_not_found/);
 assert.equal(mutations,0);
});
test("confirms cancellation with a subsequent provider read",async()=>{
 let changed=false,reads=0;
 const hooks=createStripeBilling("sk_test_mock",async()=>"cus_123",async(_url,opts)=>{
  if(opts.method==="POST"){changed=true;assert.equal(opts.body.get("cancel_at_period_end"),"true");}
  else reads++;
  return response({...base,cancel_at_period_end:changed});
 });
 assert.equal((await hooks.cancelSubscription("user","sub_123")).cancelled,true);assert.equal(reads,2);
});
test("unmapped users never call the provider",async()=>{
 const hooks=createStripeBilling("sk_test_mock",async()=>null,async()=>{throw Error("unexpected network");});
 assert.deepEqual(await hooks.listSubscriptions("user"),[]);
 await assert.rejects(hooks.cancelSubscription("user","sub_123"));
});
test("retrieves subsequent subscription pages",async()=>{
 let count=0;
 const hooks=createStripeBilling("sk_test_mock",async()=>"cus_123",async(url)=>{
  count++;const q=new URL(url).searchParams;
  if(count===1){assert.equal(q.get("customer"),"cus_123");return response({data:[base],has_more:true});}
  assert.equal(q.get("starting_after"),"sub_123");return response({data:[{...base,id:"sub_456"}],has_more:false});
 });
 assert.equal((await hooks.listSubscriptions("user")).length,2);
});

test("rejects a provider response containing a subscription belonging to another customer", async()=>{
 const adapter=createStripeBilling("test",async()=>"cus_123",async()=>new Response(JSON.stringify({data:[{id:"sub_123",customer:"cus_other",items:{data:[],has_more:false}}],has_more:false}),{status:200}));
 await assert.rejects(adapter.listSubscriptions("u"),/invalid_subscription_response/);
});
