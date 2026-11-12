export type VerifiedIdentity = {
  id: string;
  emailConfirmed: boolean;
  assuranceLevel: string | null;
};

/** Never grant owner privileges based on email address, user-supplied metadata, or URL. */
export function canAccessOwner(
  identity: VerifiedIdentity,
  configuredOwnerId: string | undefined,
): boolean {
  return (
    Boolean(configuredOwnerId?.trim()) &&
    identity.id === configuredOwnerId?.trim() &&
    identity.emailConfirmed &&
    identity.assuranceLevel === "aal2"
  );
}

export function canAccessCustomer(identity: VerifiedIdentity): boolean {
  return Boolean(identity.id && identity.emailConfirmed);
}
