import { describe, it, expect } from "vitest";
import { canAccessOrganisation as allow } from "./organisation.js";
describe("cross-tenant boundaries ported from the original identity PR",()=>{
  it("denies nonmembers",()=>expect(allow(null,"organisation:read",null)).toBe(false));
  it("denies suspended or invited members",()=>{
    expect(allow("owner","organisation:manage","suspended")).toBe(false);
    expect(allow("staff","organisation:read","invited")).toBe(false);
  });
  it("staff cannot modify tenant membership",()=>expect(allow("staff","members:manage","active")).toBe(false));
  it("only an active tenant owner may manage that tenant",()=>{
    expect(allow("owner","organisation:manage","active")).toBe(true);
    expect(allow("admin","organisation:manage","active")).toBe(false);
  });
});
