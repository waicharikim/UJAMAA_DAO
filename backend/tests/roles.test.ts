import type { PrismaClient } from '@prisma/client';

export type RoleScope = { role: string; scope?: string };

/* Canonical lists (lowercase, namespaced) */
export const GROUP_ROLES = [
  'group:member',
  'group:admin',
  'group:treasurer',
  'group:auditor',
];

export const PROJECT_ROLES = [
  'project:member',
  'project:admin',
  'project:milestone_verifier',
];

export const SYSTEM_ROLES = [
  'system:super_admin',
  'system:auditor',
  'system:compliance_officer',
  'system:support_staff',
  'system:general_user',
];

export const WALLET_ROLES = [
  'wallet:user',
  'wallet:group_admin',
  'wallet:admin',
];

export const PAYMENT_ROLES = [
  'payment:processor',
];

export const CHAIN_ROLES = [
  'chain:token_minter',
  'chain:governor_admin',
];

export const USER_ACCESS_ROLES = [
  'group:member',
  'group:admin',
  'project:member',
  'project:admin',
  'system:general_user',
  'system:super_admin',
];

export const ADMIN_ACCESS_ROLES = [
  'system:super_admin',
  'system:auditor',
  'system:compliance_officer',
];

export const ALL_ROLES = [
  ...GROUP_ROLES,
  ...PROJECT_ROLES,
  ...SYSTEM_ROLES,
  ...WALLET_ROLES,
  ...PAYMENT_ROLES,
  ...CHAIN_ROLES,
];

/* Normalization helpers */
export function normalizeRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

/* Canonical static lookup sets (normalized) */
const allLower = ALL_ROLES.map(normalizeRole);
export const ALL_ROLES_SET = new Set(allLower);
export const GROUP_ROLES_SET = new Set(GROUP_ROLES.map(normalizeRole));
export const PROJECT_ROLES_SET = new Set(PROJECT_ROLES.map(normalizeRole));
export const SYSTEM_ROLES_SET = new Set(SYSTEM_ROLES.map(normalizeRole));
export const WALLET_ROLES_SET = new Set(WALLET_ROLES.map(normalizeRole));
export const PAYMENT_ROLES_SET = new Set(PAYMENT_ROLES.map(normalizeRole));
export const CHAIN_ROLES_SET = new Set(CHAIN_ROLES.map(normalizeRole));
export const USER_ACCESS_ROLES_SET = new Set(USER_ACCESS_ROLES.map(normalizeRole));
export const ADMIN_ACCESS_ROLES_SET = new Set(ADMIN_ACCESS_ROLES.map(normalizeRole));

/* Dynamic allowlist: starts with canonical set, can be extended from DB or env */
const dynamicAllowed = new Set<string>(allLower);

/* Load dynamic roles from DB Role registry. Call during startup. */
export async function loadDynamicRoles(prisma: PrismaClient) {
  try {
    const rows = await prisma.role.findMany({ select: { name: true } });
    for (const r of rows) {
      const n = normalizeRole(r.name);
      if (n) dynamicAllowed.add(n);
    }
  } catch (err) {
    // Let caller decide whether to fail startup or continue with static roles.
    throw err;
  }
}

/* Helper to add extra roles (env or programmatic) */
export function addExtraAllowedRoles(names: string[]) {
  for (const n of names) {
    const v = normalizeRole(n);
    if (v) dynamicAllowed.add(v);
  }
}

/* Test helper to reset dynamic list */
export function resetDynamicAllowedForTests() {
  dynamicAllowed.clear();
  for (const s of allLower) dynamicAllowed.add(s);
}

/* parseRoleString and parseRoleInput */
export function parseRoleString(input: unknown): RoleScope | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(':').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { role: normalizeRole(parts[0]) };
  if (parts.length === 2) return { role: normalizeRole(parts.join(':')) };
  const scope = parts[parts.length - 1];
  const role = parts.slice(0, parts.length - 1).join(':');
  return { role: normalizeRole(role), scope: scope || undefined };
}

export function parseRoleInput(input: unknown): RoleScope | null {
  if (!input) return null;
  if (typeof input === 'string') return parseRoleString(input);
  if (typeof input === 'object') {
    const anyObj = input as any;
    const roleVal = anyObj.role;
    const scopeVal = anyObj.scope;
    const r = normalizeRole(roleVal ?? '');
    if (!r) return null;
    return { role: r, scope: scopeVal ?? undefined };
  }
  return null;
}

/* New helper: parseAndValidateRole — parse input and ensure role name is allowed in dynamicAllowed */
export function parseAndValidateRole(input: unknown): RoleScope | null {
  const parsed = parseRoleInput(input);
  if (!parsed) return null;
  if (!dynamicAllowed.has(normalizeRole(parsed.role))) return null;
  return parsed;
}

/* New helper: deterministic key for role+scope */
export function roleKey(r: RoleScope): string {
  return `${normalizeRole(r.role)}::${r.scope ?? ''}`;
}

/* Validators */
export function isValidRole(role: unknown): boolean {
  return dynamicAllowed.has(normalizeRole(role));
}

export function isGroupRole(role: unknown): boolean {
  return GROUP_ROLES_SET.has(normalizeRole(role));
}
export function isProjectRole(role: unknown): boolean {
  return PROJECT_ROLES_SET.has(normalizeRole(role));
}
export function isSystemRole(role: unknown): boolean {
  return SYSTEM_ROLES_SET.has(normalizeRole(role));
}
export function isWalletRole(role: unknown): boolean {
  return WALLET_ROLES_SET.has(normalizeRole(role));
}
export function isPaymentRole(role: unknown): boolean {
  return PAYMENT_ROLES_SET.has(normalizeRole(role));
}
export function isChainRole(role: unknown): boolean {
  return CHAIN_ROLES_SET.has(normalizeRole(role));
}