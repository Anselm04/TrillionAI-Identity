import test from "node:test";
import assert from "node:assert/strict";
import {verifiedTotpFactorIds, chooseVerifiedTotpFactor, mayEnrollBackupTotp} from "../src/mfa-factor-selection.ts";
const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("only unique verified TOTP identifiers are available for challenge selection", () => {
  assert.deepEqual(verifiedTotpFactorIds([
    {id:a,status:"verified"},{id:b,status:"verified"},
    {id:a,status:"verified"},{id:"invalid",status:"verified"},
    {id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",status:"unverified"},
  ]),[a,b]);
});
test("retains a selected backup factor and falls back when revoked", () => {
  assert.equal(chooseVerifiedTotpFactor([a,b],b),b);
  assert.equal(chooseVerifiedTotpFactor([a],b),a);
  assert.equal(chooseVerifiedTotpFactor([],b),null);
});
test("never enrolls a second authenticator before AAL2", () => {
  assert.equal(mayEnrollBackupTotp(true,"aal1"),false);
  assert.equal(mayEnrollBackupTotp(true,null),false);
  assert.equal(mayEnrollBackupTotp(true,"aal2"),true);
  assert.equal(mayEnrollBackupTotp(false,"aal1"),true);
});
