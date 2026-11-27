import test from "node:test";
import assert from "node:assert/strict";
import {rateKey,parseRateDecision,createSharedRateCheck} from "../src/shared-rate.ts";
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
