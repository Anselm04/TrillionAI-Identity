import test from "node:test";
import assert from "node:assert/strict";
import { passwordlessRequestOptions, passwordlessDeliveryStatus } from "../src/passwordless.ts";

test("passwordless initiation never auto-registers an unknown email", () => {
  assert.deepEqual(passwordlessRequestOptions("https://identity.example/verified"), {
    shouldCreateUser: false,
    emailRedirectTo: "https://identity.example/verified",
  });
});
test("unknown account responses do not disclose existence", () => {
  assert.equal(passwordlessDeliveryStatus(null), 202);
  assert.equal(passwordlessDeliveryStatus({ status: 400, code: "user_not_found" }), 202);
  assert.equal(passwordlessDeliveryStatus({ status: 404, code: "email_not_found" }), 202);
});
test("provider throttling and infrastructure failures remain explicit", () => {
  assert.equal(passwordlessDeliveryStatus({ status: 429 }), 429);
  assert.equal(passwordlessDeliveryStatus({ status: 503 }), 503);
  assert.equal(passwordlessDeliveryStatus({ status: 400, code: "invalid_request" }), 503);
});
