/**
 * @file userSerialization.ts
 *
 * @description
 * Serialize Prisma User objects into privacy-aware JSON objects suitable for API responses.
 * Adds support for an `isOwner` flag that grants full access to the owner of the profile.
 *
 * Signature:
 *   serializeUser(user, requesterRoles = [], opts = { isOwner: false })
 *
 * Behavior:
 *  - If requesterRoles contain 'system:super_admin' OR opts.isOwner === true, full access to
 *    private fields is granted.
 *  - Otherwise, visibility is determined by the user's privacySettings (or defaults).
 *
 * Returns a Partial<User>-shaped object ready for JSON response inside { data: ... } envelope.
 */

import type { User, UserPrivacySettings } from '@prisma/client';

/**
 * Default privacy settings applied when a user has no custom settings.
 * 'private' means only owner/super-admin can see. 'group' means group-scoped roles can see.
 */
export function getDefaultPrivacySettings(): Record<string, string> {
  return {
    email: 'private',
    phoneNumber: 'private',
    walletAddress: 'private',
    countyLive: 'public',
    constituencyLive: 'private',
    countyOrigin: 'private',
    constituencyOrigin: 'private',
  };
}

/**
 * Serialize user into privacy-aware representation.
 *
 * @param user - Prisma User object (may include relations like privacySettings)
 * @param requesterRoles - array of role strings (e.g., 'system:super_admin', 'group:admin')
 * @param opts - { isOwner?: boolean } - whether the requester is the profile owner
 */
export function serializeUser(
  user: User & { privacySettings?: UserPrivacySettings | null },
  requesterRoles: string[] = [],
  opts: { isOwner?: boolean } = {}
): Partial<User> {
  const isSuperAdmin = requesterRoles.includes('system:super_admin');
  const isOwner = !!opts.isOwner;

  // Resolve privacy settings (user-level) or fall back to defaults
  const privacy = user.privacySettings?.settings ?? getDefaultPrivacySettings();

  // Start with public/basic fields always included
  const result: Partial<User> = {
    id: user.id,
    name: user.name,
    industryId: user.industryId ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };

  // Helper to compute visibility for a field
  const canViewField = (field: string): boolean => {
    // Owner or super-admin can always view
    if (isSuperAdmin || isOwner) return true;

    const visibility = privacy[field] ?? 'private';
    switch (visibility) {
      case 'public':
        return true;
      case 'group':
        // requesterRoles may include group:... => allow
        return requesterRoles.some(r => r.startsWith('group:'));
      case 'private':
      default:
        return false;
    }
  };

  // Conditionally include fields
  if (canViewField('email')) result.email = user.email;
  if (canViewField('phoneNumber')) result.phoneNumber = user.phoneNumber;
  if (canViewField('walletAddress')) result.walletAddress = user.walletAddress;
  if (canViewField('countyLive')) result.countyLive = user.countyLive;
  if (canViewField('constituencyLive')) result.constituencyLive = user.constituencyLive;
  if (canViewField('countyOrigin')) result.countyOrigin = user.countyOrigin;
  if (canViewField('constituencyOrigin')) result.constituencyOrigin = user.constituencyOrigin;

  return result;
}