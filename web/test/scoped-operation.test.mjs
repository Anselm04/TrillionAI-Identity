import test from "node:test";
import assert from "node:assert/strict";
import {AccountOperationGate} from "../src/account-operation-gate.ts";
test("late checkout cannot navigate after session invalidation",async()=>{
 const gate=new AccountOperationGate();const old=gate.begin();let navigate=false;
 let resolve;const response=new Promise(r=>resolve=r);
 const work=(async()=>{await response;if(gate.current(old))navigate=true;gate.finish(old);})();
 gate.invalidate();const next=gate.begin();resolve();await work;
 assert.equal(navigate,false);assert.equal(gate.current(next),true);
});
test("old organisation response cannot publish into new organisation",async()=>{
 const gate=new AccountOperationGate();const old=gate.begin();let rows=[];
 let resolve;const response=new Promise(r=>resolve=r);
 const work=(async()=>{const data=await response;if(gate.current(old))rows=data;})();
 gate.invalidate();const next=gate.begin();rows=["new organisation"];resolve(["old organisation"]);await work;
 assert.deepEqual(rows,["new organisation"]);assert.equal(gate.finish(old),false);assert.equal(gate.finish(next),true);
});
