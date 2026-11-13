import { describe,it,expect } from "vitest";
import { latestVerifiedTotpTimestamp as latest } from "./mfa.js";
describe("MFA timestamp evidence",()=>{
  it("accepts a timestamped TOTP challenge",()=>expect(latest([{method:"totp",timestamp:100}])).toBe(100));
  it("supports normalized MFA/TOTP method names",()=>expect(latest([{method:"mfa/totp",timestamp:150}])).toBe(150));
  it("selects the most recent eligible event",()=>expect(latest([
    {method:"totp",timestamp:100},{method:"totp",timestamp:200},{method:"password",timestamp:300},
  ])).toBe(200));
  it("rejects string-only AMR evidence for fresh-owner checks",()=>expect(latest(["password","totp"])).toBeUndefined());
  it("rejects forged timestamp representations",()=>{
    expect(latest([{method:"totp",timestamp:"9999999999"}])).toBeUndefined();
    expect(latest([{method:"totp",timestamp:Infinity}])).toBeUndefined();
  });
  it("rejects missing or invalid method collections",()=>{
    expect(latest(null)).toBeUndefined();
    expect(latest({method:"totp",timestamp:200})).toBeUndefined();
  });
});
