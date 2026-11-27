import test from "node:test";
import assert from "node:assert/strict";
import {createReadinessCheck} from "../src/readiness.ts";
test("fresh successful and unsuccessful probes",async()=>{
 let calls=0;const check=createReadinessCheck(async()=>++calls===1);
 assert.equal(await check(),true);assert.equal(await check(),false);assert.equal(calls,2);
});
test("rejections and synchronous exceptions fail closed",async()=>{
 const rejected=createReadinessCheck(async()=>{throw Error("provider detail")});
 const thrown=createReadinessCheck(()=>{throw Error("provider detail")});
 assert.equal(await rejected(),false);assert.equal(await thrown(),false);
});
test("concurrent callers share one active probe",async()=>{
 let calls=0,release;const check=createReadinessCheck(()=>{calls++;return new Promise(r=>release=r);});
 const a=check(),b=check();assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);
 release(true);assert.equal(await a,true);assert.equal(await b,true);
});
test("deadline aborts and holds slot for non-cooperative probe",async()=>{
 let calls=0,release,signal;
 const check=createReadinessCheck(s=>{calls++;signal=s;return calls===1?new Promise(r=>release=r):Promise.resolve(true);},15);
 const first=check();assert.equal(await first,false);assert.equal(signal.aborted,true);
 for(let i=0;i<50;i++)assert.equal(await check(),false);
 assert.equal(calls,1);release(true);
 await new Promise(r=>setImmediate(r));
 assert.equal(await check(),true);assert.equal(calls,2);
});
test("invalid deadline rejected",()=>assert.throws(()=>createReadinessCheck(async()=>true,0)));
