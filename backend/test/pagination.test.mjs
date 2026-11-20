import test from "node:test";
import assert from "node:assert/strict";
import { collectPages } from "../src/pagination.ts";
test("exports all rows even with a provider cap smaller than requested", async () => {
  const records = ["a","b","c","d","e"];
  assert.deepEqual(await collectPages(async after => records.filter(x=>after===null||x>after).slice(0,2), x=>x), records);
});
test("empty result", async () => assert.deepEqual(await collectPages(async()=>[], x=>x), []));
test("duplicate cursor fails rather than looping", async () => assert.rejects(collectPages(async()=>["a"], x=>x), /invalid_pagination_order/));
test("provider errors propagate instead of returning a partial export", async () => assert.rejects(collectPages(async after=>{if(after)throw Error("provider");return ["a"];}, x=>x), /provider/));
