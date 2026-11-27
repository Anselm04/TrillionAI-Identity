import { describe, it, expect, vi } from "vitest";
import { requireAudit, AuditUnavailableError } from "./required-audit.js";
describe("mandatory audit completion evidence", () => {
  it("permits completion only after the audit writer succeeds", async () => {
    const write = vi.fn(async () => ({ error: null }));
    await expect(requireAudit(write)).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("rejects returned storage failures without leaking provider details", async () => {
    await expect(requireAudit(async () => ({ error: { message: "private provider detail" } })))
      .rejects.toMatchObject({ name: "AuditUnavailableError", message: "audit_unavailable" });
  });
  it("rejects thrown transport failures", async () => {
    await expect(requireAudit(async () => { throw new Error("private transport detail"); }))
      .rejects.toBeInstanceOf(AuditUnavailableError);
  });
  it("does not publish a success or retry a mutation after a failed audit", async () => {
    const publish = vi.fn();
    const write = vi.fn(async () => ({ error: true }));
    await expect((async () => { await requireAudit(write); publish(); })()).rejects.toBeInstanceOf(AuditUnavailableError);
    expect(publish).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(1);
  });
});
