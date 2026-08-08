// ---------------------------------------------------------------------------
// Permission catalog + pure evaluation. NO node/db imports — this module is
// imported by the edge proxy, server routes, and client components alike.
//
// Add a project permission by appending to PERMISSIONS, then grant it to roles
// in the admin UI (/admin/roles). Nothing else needs to change.
// ---------------------------------------------------------------------------

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
  /** Shown as a warning in the matrix — these can escalate privilege. */
  sensitive?: boolean;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: "app.access", label: "Access the app", group: "App" },

  { key: "admin.access", label: "Open the admin dashboard", group: "Admin" },
  { key: "audit.read", label: "Read the audit log", group: "Admin" },

  { key: "users.read", label: "View users", group: "Users" },
  { key: "users.write", label: "Create & edit users", group: "Users" },
  { key: "users.delete", label: "Delete users", group: "Users", sensitive: true },
  {
    key: "users.permissions",
    label: "Edit a user's permissions",
    group: "Users",
    sensitive: true,
  },

  { key: "roles.read", label: "View roles", group: "Roles" },
  {
    key: "roles.write",
    label: "Create & edit roles",
    group: "Roles",
    sensitive: true,
  },

  { key: "invites.read", label: "View invites", group: "Invites" },
  { key: "invites.write", label: "Send invites & create links", group: "Invites" },
  { key: "invites.revoke", label: "Revoke invites", group: "Invites" },

  { key: "codes.read", label: "View access codes", group: "Access codes" },
  { key: "codes.write", label: "Create access codes", group: "Access codes" },
  { key: "codes.revoke", label: "Revoke access codes", group: "Access codes" },

  { key: "waitlist.read", label: "View the waitlist", group: "Waitlist" },
  { key: "waitlist.approve", label: "Approve / reject waitlist", group: "Waitlist" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const PERMISSION_GROUPS: string[] = PERMISSIONS.reduce<string[]>(
  (acc, p) => (acc.includes(p.group) ? acc : [...acc, p.group]),
  []
);

export const WILDCARD = "*";

/** Fallback roles used before `auth_roles` is read (and by seed/migration). */
export const DEFAULT_ROLES: Record<string, string[]> = {
  owner: [WILDCARD],
  admin: PERMISSION_KEYS.filter((k) => k !== "users.delete" && k !== "roles.write"),
  manager: [
    "app.access",
    "admin.access",
    "users.read",
    "invites.read",
    "invites.write",
    "codes.read",
    "waitlist.read",
    "waitlist.approve",
  ],
  member: ["app.access"],
};

export interface UserOverrides {
  grant?: string[];
  deny?: string[];
}

/**
 * Effective permissions = role grants ∪ per-user grants − per-user denies.
 * A role holding "*" short-circuits to every catalog key (denies still apply,
 * so you can carve a capability out of an owner-ish role deliberately).
 */
export function effectivePermissions(
  rolePermissions: string[] | undefined,
  overrides: UserOverrides | null | undefined
): string[] {
  const role = rolePermissions ?? [];
  const base = role.includes(WILDCARD) ? [...PERMISSION_KEYS] : role;
  const set = new Set(base.filter((k) => PERMISSION_KEYS.includes(k)));
  for (const k of overrides?.grant ?? []) {
    if (PERMISSION_KEYS.includes(k)) set.add(k);
  }
  for (const k of overrides?.deny ?? []) set.delete(k);
  return PERMISSION_KEYS.filter((k) => set.has(k)); // stable catalog order
}

export function can(perms: string[] | undefined | null, key: string): boolean {
  if (!perms) return false;
  return perms.includes(WILDCARD) || perms.includes(key);
}

export function canAny(
  perms: string[] | undefined | null,
  keys: string[]
): boolean {
  return keys.some((k) => can(perms, k));
}

/** Where a permission came from — drives the tri-state cells in the matrix. */
export type PermissionSource = "role" | "granted" | "denied" | "none";

export function permissionSource(
  key: string,
  rolePermissions: string[] | undefined,
  overrides: UserOverrides | null | undefined
): PermissionSource {
  if ((overrides?.deny ?? []).includes(key)) return "denied";
  if ((overrides?.grant ?? []).includes(key)) return "granted";
  const role = rolePermissions ?? [];
  if (role.includes(WILDCARD) || role.includes(key)) return "role";
  return "none";
}

/** Normalize overrides coming off the wire (drops unknown keys, dedupes). */
export function sanitizeOverrides(input: unknown): UserOverrides {
  const o = (input ?? {}) as UserOverrides;
  const clean = (arr: unknown) =>
    Array.from(
      new Set(
        (Array.isArray(arr) ? arr : [])
          .map(String)
          .filter((k) => PERMISSION_KEYS.includes(k))
      )
    );
  const grant = clean(o.grant);
  const deny = clean(o.deny);
  return { grant, deny: deny.filter((k) => !grant.includes(k)) };
}

/** Normalize a role's permission list (allows the "*" wildcard). */
export function sanitizeRolePermissions(input: unknown): string[] {
  const arr = (Array.isArray(input) ? input : []).map(String);
  if (arr.includes(WILDCARD)) return [WILDCARD];
  return PERMISSION_KEYS.filter((k) => arr.includes(k));
}
