/**
 * @file normalizers.ts
 * @description
 * Small normalization helpers for user fields (wallet address, phone).
 * These are used in validation transforms or at service boundaries as a safety net.
 */

/**
 * Normalize wallet address to lowercase trimmed string.
 */
export const normalizeWalletAddress = (address?: string): string | undefined => {
  if (!address) return address;
  return address.trim().toLowerCase();
};

/**
 * Normalize Kenyan phone numbers into canonical local format starting with '0'
 * or international format starting with '+254' depending on your preference.
 *
 * This function returns a normalized '07xxxxxxxx' (local) format.
 * If you prefer international (+2547xxxxxxx), change the logic accordingly.
 */
export const normalizePhoneToLocalZero = (phone?: string): string | undefined => {
  if (!phone) return phone;
  const p = phone.replace(/\s+/g, '');
  if (p.startsWith('+254')) return '0' + p.slice(4);
  if (p.startsWith('254')) return '0' + p.slice(3);
  if (p.startsWith('0')) return p;
  if (/^[71]\d{8}$/.test(p)) return '0' + p;
  return p;
};