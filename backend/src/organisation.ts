export type OrganisationRole = "owner" | "admin" | "staff" | "customer";
export type OrganisationPermission =
  | "organisation:read" | "organisation:manage"
  | "members:read" | "members:manage";
const permissions: Readonly<Record<OrganisationRole, readonly OrganisationPermission[]>> = {
  owner: ["organisation:read","organisation:manage","members:read","members:manage"],
  admin: ["organisation:read","members:read","members:manage"],
  staff: ["organisation:read","members:read"],
  customer: ["organisation:read"],
};
/** An account's global owner/admin role does not imply membership in every tenant. */
export function canAccessOrganisation(role: OrganisationRole | null,
  permission: OrganisationPermission, status: string | null): boolean {
  return status === "active" && role !== null && permissions[role].includes(permission);
}
