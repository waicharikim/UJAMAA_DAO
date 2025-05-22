import type { User, UserPrivacySettings } from '@prisma/client';

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

export function serializeUser(
  user: User & { privacySettings?: UserPrivacySettings | null },
  requesterRoles: string[]
): Partial<User> {
  const isSuperAdmin = requesterRoles.includes('system:super_admin');
  const privacy = user.privacySettings?.settings ?? getDefaultPrivacySettings();

  const result: Partial<User> = {
    id: user.id,
    name: user.name,
    industryId: user.industryId,
    // include any other safe public fields here
  };

  const canViewField = (field: string): boolean => {
    if (isSuperAdmin) return true;
    const visibility = privacy[field] ?? 'private';
    switch (visibility) {
      case 'public':
        return true;
      case 'group':
        return requesterRoles.some(r => r.startsWith('group:'));
      case 'private':
      default:
        return false;
    }
  };

  if (canViewField('email')) result.email = user.email;
  if (canViewField('phoneNumber')) result.phoneNumber = user.phoneNumber;
  if (canViewField('walletAddress')) result.walletAddress = user.walletAddress;
  if (canViewField('countyLive')) result.countyLive = user.countyLive;
  if (canViewField('constituencyLive')) result.constituencyLive = user.constituencyLive;
  if (canViewField('countyOrigin')) result.countyOrigin = user.countyOrigin;
  if (canViewField('constituencyOrigin')) result.constituencyOrigin = user.constituencyOrigin;

  return result;
}