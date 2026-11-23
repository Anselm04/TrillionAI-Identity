import test from "node:test";
import assert from "node:assert/strict";
import {RequestGeneration} from "../src/request-generation.ts";

function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r});
  return {promise,resolve};
}
test("a profile/MFA reload cannot publish after sign-out",async()=>{
  const generation=new RequestGeneration();
  const pending=deferred();
  const ticket=generation.begin();
  let profile="signed-in";
  const worker=pending.promise.then(value=>{
    if(generation.isCurrent(ticket))profile=value;
  });
  generation.invalidate();profile=null;
  pending.resolve("old account");
  await worker;
  assert.equal(profile,null);
});
test("a stale deletion-readiness response cannot replace newer session state",async()=>{
  const generation=new RequestGeneration();
  const original=deferred();
  const newer=deferred();
  let result=null;
  const firstTicket=generation.begin();
  const first=original.promise.then(value=>{
    if(generation.isCurrent(firstTicket))result=value;
  });
  generation.invalidate();
  const secondTicket=generation.begin();
  const second=newer.promise.then(value=>{
    if(generation.isCurrent(secondTicket))result=value;
  });
  newer.resolve("current account");await second;
  original.resolve("former account");await first;
  assert.equal(result,"current account");
});
test("a later explicit reload supersedes earlier account security results",async()=>{
  const generation=new RequestGeneration();
  const one=generation.begin();
  const two=generation.begin();
  assert.equal(generation.isCurrent(one),false);
  assert.equal(generation.isCurrent(two),true);
});
