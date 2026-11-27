/** Mandatory completion evidence; external provider mutations cannot be rolled back here. */
export class AuditUnavailableError extends Error {
  constructor() {
    super("audit_unavailable");
    this.name = "AuditUnavailableError";
  }
}
export async function requireAudit(write: () => Promise<{ error: unknown }>): Promise<void> {
  try {
    const result = await write();
    if (result.error !== null) throw new AuditUnavailableError();
  } catch {
    // Never disclose provider errors or sensitive records to the caller.
    throw new AuditUnavailableError();
  }
}
