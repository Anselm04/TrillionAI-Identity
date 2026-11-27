import test from "node:test";
import assert from "node:assert/strict";
import {rateKey,parseRateDecision,createSharedRateCheck,enforceCombinedRate,accountRateKey,accountRateOutcome} from "../src/shared-rate.ts";
const secret="a".repeat(32),allow={allowed:true,remaining:19,reset_epoch:900};
test("stable pseudonymous key across replicas and separation of addresses",()=>{
 assert.equal(rateKey(secret,"192.0.2.1"),rateKey(secret,"192.0.2.1"));
 assert.notEqual(rateKey(secret,"192.0.2.1"),rateKey(secret,"192.0.2.2"));
 assert.throws(()=>rateKey("short","192.0.2.1"));
 assert.throws(()=>rateKey(secret,""));
});
test("malformed store results never authorize",async()=>{
 for(const value of [null,{}, {allowed:"true",remaining:19,reset_epoch:900},{allowed:false,remaining:1,reset_epoch:900}]){
 assert.equal(parseRateDecision(value),null);
 assert.equal(await createSharedRateCheck(async()=>value)("key"),null);
 }
 assert.deepEqual(await createSharedRateCheck(async()=>allow)("key"),allow);
 assert.equal(await createSharedRateCheck(async()=>{throw Error("private");})("key"),null);
});
test("bounded pending calls and late completion fail closed",async()=>{
 let release,signal,calls=0;
 const check=createSharedRateCheck((_key,s)=>{calls++;signal=s;return new Promise(r=>release=r);},1,15);
 const first=check("key");
 assert.equal(await check("other"),null);
 assert.equal(await first,null);assert.equal(signal.aborted,true);
 assert.equal(await check("other"),null);assert.equal(calls,1);
 release(allow);await new Promise(r=>setImmediate(r));
 const next=check("key");await Promise.resolve();release(allow);assert.deepEqual(await next,allow);
});

test("legacy denial prevents rolling call and preserves active restrictions",async()=>{
 const denied={allowed:false,remaining:0,reset_epoch:1800};
 const result=await enforceCombinedRate("key",new AbortController().signal,async()=>denied,async()=>{assert.fail("rolling called after legacy denial");});
 assert.deepEqual(result,denied);
});
test("both counters must allow, and rolling denial remains authoritative",async()=>{
 const deny={allowed:false,remaining:0,reset_epoch:1200};
 const signal=new AbortController().signal;
 assert.deepEqual(await enforceCombinedRate("key",signal,async()=>allow,async()=>deny),deny);
 assert.deepEqual(await enforceCombinedRate("key",signal,async()=>allow,async()=>({...allow,remaining:4,reset_epoch:1200})),{allowed:true,remaining:4,reset_epoch:1200});
 assert.equal(await enforceCombinedRate("key",signal,async()=>allow,async()=>null),null);
});
test("aborted legacy completion never starts another RPC",async()=>{
 const controller=new AbortController();
 assert.equal(await enforceCombinedRate("key",controller.signal,async()=>{controller.abort();return allow;},async()=>assert.fail("rolling called after abort")),null);
});

test("account abuse keys are stable across casing and separate from IP and delivery scopes",()=>{
 const a=accountRateKey(secret,"login","Example@EXAMPLE.COM","192.0.2.1");
 assert.equal(a,accountRateKey(secret,"login"," example@example.com ","192.0.2.1"));
 assert.notEqual(a,accountRateKey(secret,"email-delivery","example@example.com"));
 assert.notEqual(a,rateKey(secret,"example@example.com"));
 assert.notEqual(a,accountRateKey(secret,"login","other@example.com","192.0.2.1"));
 assert.throws(()=>accountRateKey("short","login","example@example.com","192.0.2.1"));
});
test("delivery suppression is neutral and login limits do not disclose account existence",()=>{
 const deny={allowed:false,remaining:0,reset_epoch:900};
 assert.equal(accountRateOutcome("email-delivery",deny),"neutral");
 assert.equal(accountRateOutcome("login",deny),"limited");
 for(const scope of ["login","email-delivery"]){
 assert.equal(accountRateOutcome(scope,null),"unavailable");
 assert.equal(accountRateOutcome(scope,allow),"allow");
 }
});

test("unrelated login sources cannot exhaust the same target login bucket",()=>{
 const first=accountRateKey(secret,"login","example@example.com","192.0.2.1");
 assert.notEqual(first,accountRateKey(secret,"login","example@example.com","192.0.2.2"));
 assert.throws(()=>accountRateKey(secret,"login","example@example.com"));
 assert.equal(accountRateKey(secret,"email-delivery","example@example.com","192.0.2.1"),accountRateKey(secret,"email-delivery","example@example.com","192.0.2.2"));
});
