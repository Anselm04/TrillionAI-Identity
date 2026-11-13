/** AAM/AMR data is provider-controlled, but may use detailed or RFC8176 string records.
 * Only a timestamped TOTP event proves a *recent* verified TOTP step-up.
 */
export function latestVerifiedTotpTimestamp(methods: unknown): number | undefined {
  if (!Array.isArray(methods)) return undefined;
  let latest = 0;
  for (const method of methods) {
    if (typeof method !== "object" || method === null) continue;
    const candidate = method as Record<string, unknown>;
    if (candidate.method !== "totp" && candidate.method !== "mfa/totp") continue;
    if (typeof candidate.timestamp !== "number" || !Number.isSafeInteger(candidate.timestamp)) continue;
    if (candidate.timestamp > latest) latest = candidate.timestamp;
  }
  return latest > 0 ? latest : undefined;
}
