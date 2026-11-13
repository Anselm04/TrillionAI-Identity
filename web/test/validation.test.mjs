import test from "node:test";
import assert from "node:assert/strict";
import { validateRegistration } from "../src/validation.ts";
test("rejects malformed email",()=>assert.match(validateRegistration("bad","validpassword123","validpassword123"),/email/));
test("rejects short password",()=>assert.match(validateRegistration("a@example.com","short","short"),/12/));
test("rejects long password",()=>assert.match(validateRegistration("a@example.com","a".repeat(129),"a".repeat(129)),/128/));
test("rejects mismatched passwords",()=>assert.match(validateRegistration("a@example.com","validpassword123","differentpassword123"),/match/));
test("accepts a well-formed registration",()=>assert.equal(validateRegistration("a@example.com","validpassword123","validpassword123"),null));
