import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/vendor/supabase/safe-next-path.ts";
const origin="https://identity.example.com";
test("valid local redirect retains query and fragment",()=>assert.equal(safeNextPath("/account?tab=security#sessions","/",origin),"/account?tab=security#sessions"));
test("untrusted external redirect is rejected",()=>{for(const input of ["https://evil.example","//evil.example","/\\evil.example","javascript:alert(1)",null,42])assert.equal(safeNextPath(input,"/",origin),"/");});
