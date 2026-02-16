// src/core/rbac/roles.ts
// 100% based on your base.prisma enums — never changes

export const SystemRoles = {
  SUPER_ADMIN: "super_admin",
  AUDITOR: "auditor",
  COMPLIANCE_OFFICER: "compliance_officer",
  SUPPORT_STAFF: "support_staff",
  GENERAL_USER: "general_user",
  GOVERNOR_ADMIN: "governor_admin",
} as const;

export const GroupRoles = {
  MEMBER: "MEMBER",
  LEADER: "LEADER",
  TREASURER: "TREASURER",
  AUDITOR: "AUDITOR",
  FACILITATOR: "FACILITATOR",
  MENTOR: "MENTOR",
} as const;

export type SystemRole = keyof typeof SystemRoles;
export type GroupRole = keyof typeof GroupRoles;
export type AnyRole = SystemRole | GroupRole;