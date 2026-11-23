import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeEvent, subscriptionEvent } from "../src/stripe-webhook.ts";

const secret = "whsec_offline_test_only";
const now = 1_800_000_000_000;
const timestamp = Math.floor(now / 1000);
const fixture = {
  id: "evt_offline123", type: "customer.subscription.updated", created: timestamp,
  livemode: false, data: { object: { id: "sub_offline123", customer: "cus_offline123", status: "active" } },
};
function signed(value = fixture, time = timestamp, key = secret) {
  const raw = Buffer.from(JSON.stringify(value));
  const v1 = createHmac("sha256", key).update(`${time}.`).update(raw).digest("hex");
  return { raw, signature: `t=${time},v1=${v1}` };
}

test("accepts a valid locally signed event and maps only known subscription events", () => {
  const { raw, signature } = signed();
  const event = verifyStripeEvent(raw, signature, secret, now);
  assert.deepEqual(subscriptionEvent(event), {
    eventId: fixture.id, customerId: "cus_offline123", subscriptionId: "sub_offline123",
    eventCreated: timestamp, status: "active", liveMode: false,
  });
  assert.equal(subscriptionEvent({ ...event, type: "invoice.payment_failed" }), null);
});

test("rejects altered payloads, forged signatures and mismatched webhook secrets", () => {
  const { raw, signature } = signed();
  const tampered = Buffer.from(raw.toString().replace("active", "past_due"));
  assert.throws(() => verifyStripeEvent(tampered, signature, secret, now), /invalid_signature/);
  assert.throws(() => verifyStripeEvent(raw, signature.replace(/v1=[0-9a-f]+/, `v1=${"0".repeat(64)}`), secret, now), /invalid_signature/);
  assert.throws(() => verifyStripeEvent(raw, signed(fixture, timestamp, "whsec_wrong").signature, secret, now), /invalid_signature/);
});

test("rejects stale, future, missing and ambiguous timestamps", () => {
  for (const time of [timestamp - 301, timestamp + 301]) {
    const { raw, signature } = signed(fixture, time);
    assert.throws(() => verifyStripeEvent(raw, signature, secret, now), /expired_signature/);
  }
  const { raw, signature } = signed();
  assert.throws(() => verifyStripeEvent(raw, signature.replace(/t=\d+,/, ""), secret, now), /invalid_signature/);
  assert.throws(() => verifyStripeEvent(raw, `t=${timestamp},${signature}`, secret, now), /invalid_signature/);
});

test("rejects malformed signed events and invalid subscription records", () => {
  for (const event of [
    { ...fixture, id: "wrong" },
    { ...fixture, created: "bad" },
    { ...fixture, livemode: "false" },
    { ...fixture, data: { object: [] } },
  ]) {
    const { raw, signature } = signed(event);
    assert.throws(() => verifyStripeEvent(raw, signature, secret, now), /invalid_event/);
  }
  const { raw, signature } = signed();
  const valid = verifyStripeEvent(raw, signature, secret, now);
  for (const object of [
    { id: "sub_offline123", customer: "another_customer", status: "active" },
    { id: "invalid", customer: "cus_offline123", status: "active" },
    { id: "sub_offline123", customer: "cus_offline123", status: 22 },
  ]) assert.throws(() => subscriptionEvent({ ...valid, data: { object } }), /invalid_subscription_event/);
});

test("rejects oversized webhook payloads before parsing", () => {
  const { signature } = signed();
  assert.throws(() => verifyStripeEvent(Buffer.alloc(262145), signature, secret, now), /invalid_webhook/);
});
