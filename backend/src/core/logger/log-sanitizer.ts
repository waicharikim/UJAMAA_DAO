/**
 * @file log-sanitizer.ts
 * @description
 * Centralized PII sanitization and data protection for logging
 * GDPR/CCPA/Kenya DPA compliant
 * 
 * Version: 1.1 — January 2026
 */

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface SanitizationConfig {
  emailVisibleChars: number;
  walletVisibleStart: number;
  walletVisibleEnd: number;
  ipOctetsToShow: number;
  phoneVisibleStart: number;
  phoneVisibleEnd: number;
  maxStringLength: number;
}

const DEFAULT_CONFIG: SanitizationConfig = {
  emailVisibleChars: 2,
  walletVisibleStart: 6,
  walletVisibleEnd: 4,
  ipOctetsToShow: 2,
  phoneVisibleStart: 5,
  phoneVisibleEnd: 4,
  maxStringLength: 1000,
};

// ============================================================================
// PII DETECTION
// ============================================================================

export function looksLikeEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export function looksLikeWallet(str: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(str) || 
         /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(str);
}

export function looksLikeIP(str: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(str) || 
         /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/.test(str);
}

export function looksLikePhone(str: string): boolean {
  const cleaned = str.replace(/[\s\-()]/g, '');
  return /^(\+?254|0)[1-7]\d{8}$/.test(cleaned) || 
         /^\+?[1-9]\d{1,14}$/.test(cleaned);
}

export function looksLikeCreditCard(str: string): boolean {
  const cleaned = str.replace(/[\s\-]/g, '');
  return /^\d{13,19}$/.test(cleaned);
}

// ============================================================================
// REDACTION FUNCTIONS
// ============================================================================

export function redactEmail(
  email?: string | null,
  config: Partial<SanitizationConfig> = {}
): string {
  if (!email || typeof email !== 'string') return '';
  const cfg = { ...DEFAULT_CONFIG, ...config };
  try {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '[invalid-email]';
    const visible = Math.min(cfg.emailVisibleChars, Math.floor(local.length / 2));
    return `${local.slice(0, visible)}***@${domain}`;
  } catch {
    return '[redacted-email]';
  }
}

export function redactWallet(
  wallet?: string | null,
  config: Partial<SanitizationConfig> = {}
): string {
  if (!wallet || typeof wallet !== 'string') return '';
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (wallet.length < cfg.walletVisibleStart + cfg.walletVisibleEnd) return '[invalid-wallet]';
  return `${wallet.slice(0, cfg.walletVisibleStart)}...${wallet.slice(-cfg.walletVisibleEnd)}`;
}

export function redactIP(
  ip?: string | null,
  config: Partial<SanitizationConfig> = {}
): string {
  if (!ip || typeof ip !== 'string') {
    return 'xxx.xxx.xxx.xxx';
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const visibleCount = Math.max(0, Math.min(cfg.ipOctetsToShow, 4));

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4 && parts.every(o => o.length > 0 && !isNaN(Number(o)))) {
      const visible = parts.slice(0, visibleCount).join('.');
      const masked = Array(4 - visibleCount).fill('xxx').join('.');
      return visibleCount > 0 ? `${visible}.${masked}` : 'xxx.xxx.xxx.xxx';
    }
    // Invalid or non-standard IPv4 format
    return 'xxx.xxx.xxx.xxx';
  }

  // IPv6
  if (ip.includes(':')) {
    return 'xxxx:xxxx::';
  }

  // Any other format (localhost, unknown, etc.)
  return 'xxx.xxx.xxx.xxx';
}

export function redactPhone(
  phone?: string | null,
  config: Partial<SanitizationConfig> = {}
): string {
  if (!phone || typeof phone !== 'string') return '';
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Kenyan formats – prioritize common local patterns
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return `${cleaned.slice(0, 7)}***${cleaned.slice(-4)}`; // 2547123***6789
  }
  if (cleaned.startsWith('+254') && cleaned.length === 13) {
    return `${cleaned.slice(0, 8)}***${cleaned.slice(-4)}`; // +2547123***6789
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.slice(0, 5)}***${cleaned.slice(-4)}`; // 07123***6789
  }

  // Generic fallback
  if (cleaned.length < cfg.phoneVisibleStart + cfg.phoneVisibleEnd) return '[invalid-phone]';
  return `${cleaned.slice(0, cfg.phoneVisibleStart)}***${cleaned.slice(-cfg.phoneVisibleEnd)}`;
}

export function redactCreditCard(card?: string | null): string {
  if (!card || typeof card !== 'string') return '';
  const cleaned = card.replace(/[\s\-]/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return '[invalid-card]';
  return `****-****-****-${cleaned.slice(-4)}`;
}

// ============================================================================
// HASHING & GENERAL SANITIZATION
// ============================================================================

export function hashIdentifier(
  value: string,
  algorithm: 'sha256' | 'sha512' = 'sha256',
  truncate: number = 16
): string {
  if (!value) return 'none';
  const hash = crypto.createHash(algorithm).update(value).digest('hex');
  return truncate > 0 ? hash.slice(0, truncate) : hash;
}

export function sanitizeLogMessage(
  msg: any,
  config: Partial<SanitizationConfig> = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (typeof msg !== 'string') msg = String(msg);
  const sanitized = msg.replace(/[\n\r\t\x00-\x1F\x7F]/g, ' ');
  return sanitized.length > cfg.maxStringLength 
    ? sanitized.slice(0, cfg.maxStringLength) + '... [truncated]'
    : sanitized;
}

export function sanitizeUserAgent(ua?: string): string {
  if (!ua || typeof ua !== 'string') return 'unknown';
  return ua.replace(/[^\x20-\x7E]/g, '').slice(0, 200);
}

export function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url, 'http://dummy');
    return parsed.pathname;
  } catch {
    return url.split('?')[0] || '/';
  }
}

export function autoRedactString(str: string): string {
  if (typeof str !== 'string' || str.length === 0) return str;
  if (looksLikeEmail(str)) return redactEmail(str);
  if (looksLikeWallet(str)) return redactWallet(str);
  if (looksLikeIP(str)) return redactIP(str);
  if (looksLikePhone(str)) return redactPhone(str);
  if (looksLikeCreditCard(str)) return redactCreditCard(str);
  return str;
}

// ============================================================================
// BULK OBJECT REDACTION
// ============================================================================

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /ssn/i,
  /credit[_-]?card/i,
  /cvv/i,
  /pin/i,
];

function isSensitiveKeyName(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

export function autoRedactObject(obj: any, depth = 0): any {
  if (depth > 10) return '[max-depth]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj !== 'object') {
    return typeof obj === 'string' ? autoRedactString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => autoRedactObject(item, depth + 1));
  }

  const redacted: any = {};
  for (const key in obj) {
    if (isSensitiveKeyName(key)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = autoRedactObject(obj[key], depth + 1);
    }
  }
  return redacted;
}

export function containsPII(data: any): boolean {
  if (typeof data === 'string') {
    return looksLikeEmail(data) || 
           looksLikeWallet(data) || 
           looksLikeIP(data) || 
           looksLikePhone(data) ||
           looksLikeCreditCard(data);
  }
  if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (isSensitiveKeyName(key) || containsPII(data[key])) return true;
    }
  }
  return false;
}

export function isSafeToLog(data: any): boolean {
  return !containsPII(data);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  looksLikeEmail,
  looksLikeWallet,
  looksLikeIP,
  looksLikePhone,
  looksLikeCreditCard,
  redactEmail,
  redactWallet,
  redactIP,
  redactPhone,
  redactCreditCard,
  hashIdentifier,
  sanitizeLogMessage,
  sanitizeUserAgent,
  sanitizeURL,
  autoRedactString,
  autoRedactObject,
  containsPII,
  isSafeToLog,
};