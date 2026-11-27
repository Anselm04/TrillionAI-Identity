import test from "node:test";
import assert from "node:assert/strict";
import { passwordlessRequestOptions } from "../src/passwordless.ts";

test("passwordless initiation never auto-registers an unknown email", () => {
  assert.deepEqual(passwordlessRequestOptions("https://identity.example/verified"), {
    shouldCreateUser: false,
    emailRedirectTo: "https://identity.example/verified",
  });
});
test("passwordless callbacks reject unsafe redirects and credential-bearing URLs", () => {
  for (const url of [
    "http://identity.example/verified",
    "https://user:secret@identity.example/verified",
    "https://identity.example/verified#token",
    "https://identity.example/verified?code=secret",
    "javascript:alert(1)",
    "not-a-url",
  ]) {
    assert.throws(() => passwordlessRequestOptions(url));
  }
  assert.equal(
    passwordlessRequestOptions("http://localhost:3000/verified").emailRedirectTo,
    "http://localhost:3000/verified"
  );
});

test("passwordless callback policy rejects alternate schemes and ambiguous URLs", () => {
  for (const url of [
    "ftp://identity.example/verified",
    "data:text/html,hello",
    "file:///verified",
    "http://localhost.evil.example/verified",
    "http://127.0.0.2:3000/verified",
    "https://identity.example/verified?next=https://evil.example",
    "https://identity.example/verified#access_token=secret",
    "https://user@identity.example/verified",
  ]) {
    assert.throws(() => passwordlessRequestOptions(url), { message: "Invalid passwordless callback URL" });
  }
  assert.equal(
    passwordlessRequestOptions("https://identity.example/verified").emailRedirectTo,
    "https://identity.example/verified"
  );
  assert.equal(
    passwordlessRequestOptions("http://127.0.0.1:3000/verified").emailRedirectTo,
    "http://127.0.0.1:3000/verified"
  );
});
