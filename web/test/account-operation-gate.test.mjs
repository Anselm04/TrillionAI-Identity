import test from "node:test";
import assert from "node:assert/strict";
import {AccountOperationGate} from "../src/account-operation-gate.ts";

test("prevents same-tick overlapping profile and account mutations",()=>{
  const gate=new AccountOperationGate();
  const profile=gate.begin();
  assert.equal(typeof profile,"number");
  assert.equal(gate.begin(),null);
  assert.equal(gate.current(profile),true);
  assert.equal(gate.finish(profile),true);
  assert.equal(typeof gate.begin(),"number");
});
test("logout invalidates pending mutation callbacks without unlocking a newer operation",()=>{
  const gate=new AccountOperationGate();
  const old=gate.begin();
  gate.invalidate();
  const next=gate.begin();
  assert.equal(gate.current(old),false);
  assert.equal(gate.finish(old),false);
  assert.equal(gate.current(next),true);
  assert.equal(gate.finish(next),true);
});
test("stale completion and invalid tickets cannot finish current request",()=>{
  const gate=new AccountOperationGate();
  assert.equal(gate.finish(123),false);
  const t=gate.begin();
  assert.equal(gate.current(t+1),false);
  assert.equal(gate.finish(t+1),false);
  assert.equal(gate.begin(),null);
});
