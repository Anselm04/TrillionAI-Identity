export type Permission = 'organisation:read' | 'organisation:manage' | 'members:read' | 'members:manage';
export type Role = 'owner' | 'admin' | 'staff' | 'customer';
export const rolePermissions: Readonly<Record<Role, readonly Permission[]>> = {
  owner: ['organisation:read','organisation:manage','members:read','members:manage'],
  admin: ['organisation:read','members:read','members:manage'],
  staff: ['organisation:read','members:read'],
  customer: ['organisation:read']
};
export function hasPermission(role: Role | null, permission: Permission): boolean {
  return role !== null && rolePermissions[role].includes(permission);
}
