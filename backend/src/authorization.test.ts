import { describe, expect, it } from "vitest";
import { canAccessCustomer, canAccessOwner } from "./authorization.js";

const owner = "11111111-1111-4111-8111-111111111111";
const verified = { id: owner, emailConfirmed: true, assuranceLevel: "aal2" };
describe("authorization boundaries", () => {
  it("denies owner access until real owner ID is configured", () => {
    expect(canAccessOwner(verified, "")).toBe(false);
    expect(canAccessOwner(verified, undefined)).toBe(false);
  });
  it("denies a different user even with MFA", () => {
    expect(canAccessOwner({ ...verified, id: "other" }, owner)).toBe(false);
  });
  it("denies owner without email verification or AAL2 MFA", () => {
    expect(canAccessOwner({ ...verified, emailConfirmed: false }, owner)).toBe(false);
    expect(canAccessOwner({ ...verified, assuranceLevel: "aal1" }, owner)).toBe(false);
    expect(canAccessOwner({ ...verified, assuranceLevel: null }, owner)).toBe(false);
  });
  it("allows only the fully verified owner", () => {
    expect(canAccessOwner(verified, owner)).toBe(true);
  });
  it("allows verified regular customer without phone verification", () => {
    expect(canAccessCustomer({ id: "customer", emailConfirmed: true, assuranceLevel: "aal1" })).toBe(true);
    expect(canAccessCustomer({ id: "customer", emailConfirmed: false, assuranceLevel: "aal1" })).toBe(false);
  });
});
