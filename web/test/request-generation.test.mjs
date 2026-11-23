import test from "node:test";
import assert from "node:assert/strict";
import { RequestGeneration } from "../src/request-generation.ts";

test("late response from a superseded request cannot publish state",()=>{
  const requests = new RequestGeneration();
  const first=requests.begin();
  const second=requests.begin();
  assert.equal(requests.isCurrent(first),false);
  assert.equal(requests.isCurrent(second),true);
});
test("sign-out invalidates a pending operation even without replacement",()=>{
  const requests=new RequestGeneration();
  const inFlight=requests.begin();
  requests.invalidate();
  assert.equal(requests.isCurrent(inFlight),false);
  assert.equal(requests.isCurrent(requests.begin()),true);
});
test("rejects missing, future and malformed tickets",()=>{
  const requests=new RequestGeneration();
  assert.equal(requests.isCurrent(0),false);
  assert.equal(requests.isCurrent(NaN),false);
  const current=requests.begin();
  assert.equal(requests.isCurrent(current+1),false);
  assert.equal(requests.isCurrent(current),true);
});
