import { describe, expect, it } from "vitest";
import { developerClientInput, redirectUri } from "./developer-client.js";

describe("developer OAuth redirect URI registration", () => {
  it("accepts a canonical HTTPS callback and unique non-reserved query parameters", () => {
    expect(redirectUri.safeParse("https://example.com/callback").success).toBe(true);
    expect(redirectUri.safeParse("https://example.com/callback?tenant=one&mode=login").success).toBe(true);
  });

  it.each(["state", "code", "error", "error_description", "error_uri"])(
    "rejects reserved OAuth response parameter %s", name => {
      expect(redirectUri.safeParse(`https://example.com/callback?${name}=preexisting`).success).toBe(false);
    },
  );

  it("rejects duplicate query names, including distinct values", () => {
    expect(redirectUri.safeParse("https://example.com/callback?tenant=a&tenant=b").success).toBe(false);
    expect(redirectUri.safeParse("https://example.com/callback?tenant=a&tenant=a").success).toBe(false);
  });

  it("rejects malformed and noncanonical callbacks through the full registration schema", () => {
    const base = { name: "Example", client_type: "public" as const };
    for (const uri of [
      "http://example.com/callback",
      "https://example.com/callback#fragment",
      "https://example.com/callback?code=old",
      "https://example.com/callback?x=1&x=2",
    ]) {
      expect(developerClientInput.safeParse({ ...base, redirect_uris: [uri] }).success).toBe(false);
    }
    expect(developerClientInput.safeParse({
      ...base, redirect_uris: ["https://example.com/callback"],
    }).success).toBe(true);
  });
});
