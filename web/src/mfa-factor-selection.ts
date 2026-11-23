/** Verified TOTP factors only. The provider validates codes; this helper never grants access. */
export type VerifiedTotpFactor = { id: string; status: string };
export function verifiedTotpFactorIds(factors: readonly VerifiedTotpFactor[]): string[] {
  const seen = new Set<string>();
  for (const factor of factors) {
    if (factor.status !== "verified" || typeof factor.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(factor.id)) continue;
    seen.add(factor.id);
  }
  return [...seen];
}
export function chooseVerifiedTotpFactor(ids: readonly string[], previous: string | null): string | null {
  return previous && ids.includes(previous) ? previous : ids[0] ?? null;
}
export function mayEnrollBackupTotp(hasVerifiedFactor: boolean, assurance: "aal1" | "aal2" | null): boolean {
  return !hasVerifiedFactor || assurance === "aal2";
}
