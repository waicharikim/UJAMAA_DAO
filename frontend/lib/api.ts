import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser'

/**
 * UjamaaDAO API Client
 *
 * Wired to the real backend at NEXT_PUBLIC_API_URL (default: http://localhost:4000/api/v1).
 * Handles JWT injection, 401 auto-refresh, and typed responses.
 *
 * Auth flow (magic link):
 *   1. requestMagicLink(email)  → POST /auth/magic-link/send
 *   2. User clicks email link   → browser lands on /auth/callback?token=...
 *   3. verifyMagicLink(token)   → GET /auth/login?token=...  → { accessToken, refreshToken, user }
 *   4. All subsequent calls send Authorization: Bearer <accessToken>
 *
 * Backend field names (not the frontend User type names):
 *   name (not username), phoneNumber (not phone), avatarUrl (not avatar)
 *   geographic.primaryCounty.name, geographic.primaryConstituency.name
 *   impact.global, economic.participationRights
 */

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(/\/$/, "")

// ─────────────────────────────────────────────────────────
// Token storage helpers
// ─────────────────────────────────────────────────────────

export const tokenStore = {
  getAccess: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
  getRefresh: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null,
  set: (access: string, refresh?: string) => {
    if (typeof window === "undefined") return
    localStorage.setItem("access_token", access)
    if (refresh) localStorage.setItem("refresh_token", refresh)
  },
  clear: () => {
    if (typeof window === "undefined") return
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
  },
}

// ─────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

let refreshPromise: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = tokenStore.getRefresh()
    if (!refreshToken) return null

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        tokenStore.clear()
        return null
      }
      const body: ApiResponse<{ accessToken: string; refreshToken?: string }> = await res.json()
      if (body.success && body.data.accessToken) {
        tokenStore.set(body.data.accessToken, body.data.refreshToken)
        return body.data.accessToken
      }
      tokenStore.clear()
      return null
    } catch {
      tokenStore.clear()
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const accessToken = tokenStore.getAccess()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Auto-refresh on 401
  if (res.status === 401 && retry) {
    const newToken = await tryRefresh()
    if (newToken) {
      return apiFetch<T>(path, options, false)
    }
    tokenStore.clear()
    throw new ApiError(401, "Session expired. Please log in again.")
  }

  let body: any
  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    body = await res.json()
  } else {
    body = await res.text()
  }

  if (!res.ok) {
    const message = body?.message || body?.error || `HTTP ${res.status}`
    const errors = body?.details?.validation?.errors as Record<string, string> | undefined
    throw new ApiError(res.status, message, errors)
  }

  // Backend wraps all responses in { success, data, message }
  if (body && typeof body === "object" && "data" in body) {
    return body.data as T
  }
  return body as T
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string>
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function buildQs(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ""
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== "all" && v !== 0) {
      q.set(k, String(v))
    }
  }
  const qs = q.toString()
  return qs ? `?${qs}` : ""
}

// ─────────────────────────────────────────────────────────
// Auth endpoints
// ─────────────────────────────────────────────────────────

export const authApi = {
  /**
   * POST /auth/magic-link/send
   * Sends a magic link email. No token required.
   */
  requestMagicLink: (params: {
    email: string
    name?: string
    phoneNumber?: string
    primaryWardId?: string
    secondaryWardId?: string
    industryIds?: string[]
    goodsServiceIds?: string[]
    messagingPlatforms?: Array<{
      platform: "TELEGRAM" | "WHATSAPP" | "DISCORD"
      handle?: string
    }>
  }) =>
    apiFetch<void>("/auth/magic-link/send", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * GET /auth/login?token=...
   * Exchanges the magic link JWT (existing users) for a session.
   * Backend returns MagicLinkAuthResult: { sessionToken, user, session, needsProfileCompletion }
   * NOTE: field is `sessionToken`, NOT `accessToken`. No refresh token — 7-day lifetime (ADR-022).
   */
  verifyMagicLink: (token: string) =>
    apiFetch<{ sessionToken: string; user: any; session: any; needsProfileCompletion: boolean }>(
      `/auth/login?token=${encodeURIComponent(token)}`
    ),

  /**
   * GET /auth/verify-email?token=...
   * Exchanges an email verification token (hex, for new users) for a session.
   * Returns { sessionToken, user, session, needsProfileCompletion }
   */
  verifyEmailToken: (token: string) =>
    apiFetch<{ sessionToken: string; user: any; session: any; needsProfileCompletion: boolean }>(
      `/auth/verify-email?token=${encodeURIComponent(token)}`
    ),

  /**
   * POST /auth/refresh
   * Exchange refresh token for new access token (called automatically by apiFetch on 401).
   */
  refresh: (refreshToken: string) =>
    apiFetch<{ accessToken: string; refreshToken?: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  /**
   * POST /auth/logout
   * Revoke the current session. Requires auth.
   */
  logout: () =>
    apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => {
      // Logout best-effort — clear local state regardless
    }),

  /**
   * POST /auth/phone/send-code
   * Send SMS verification code to phone number.
   * Requires: EMAIL_VERIFIED
   */
  sendPhoneCode: (phoneNumber: string, channel: "sms" | "whatsapp" | "telegram" = "sms") =>
    apiFetch<{ expiresIn: number; devCode?: string; telegramCode?: string }>("/auth/phone/send-code", {
      method: "POST",
      body: JSON.stringify({ phoneNumber, channel }),
    }),

  /**
   * POST /auth/phone/verify-code
   * Verify the SMS code.
   * Requires: EMAIL_VERIFIED
   */
  verifyPhoneCode: (phoneNumber: string, code: string) =>
    apiFetch<{ verified: boolean }>("/auth/phone/verify-code", {
      method: "POST",
      body: JSON.stringify({ phoneNumber, code }),
    }),

  /**
   * GET /auth/sessions
   * List active sessions. Requires: COMMUNITY_VERIFIED
   */
  getSessions: () => apiFetch<any[]>("/auth/sessions"),

  /**
   * DELETE /auth/sessions/:sessionId
   * Revoke a specific session. Requires: COMMUNITY_VERIFIED
   */
  revokeSession: (sessionId: string) =>
    apiFetch<void>(`/auth/sessions/${sessionId}`, { method: "DELETE" }),

  /**
   * GET /auth/security-events
   * Recent security events. Requires: COMMUNITY_VERIFIED
   */
  getSecurityEvents: () => apiFetch<any[]>("/auth/security-events"),

  /**
   * POST /auth/wallet/nonce
   * Get a challenge nonce for wallet linking. No auth required.
   */
  getWalletNonce: (walletAddress: string) =>
    apiFetch<{ nonce: string; message: string; expiresIn: number }>("/auth/wallet/nonce", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    }),

  /**
   * POST /auth/wallet/verify
   * Sign in using a wallet signature. Returns sessionToken + user (no existing session required).
   */
  walletLogin: (walletAddress: string, signature: string) =>
    apiFetch<{ sessionToken: string; user: any; needsProfileCompletion: boolean }>(
      "/auth/wallet/verify",
      {
        method: "POST",
        body: JSON.stringify({ walletAddress, signature }),
      }
    ),

  /**
   * POST /auth/wallet/link
   * Link a wallet to the authenticated account. Requires auth + signature.
   */
  linkWallet: (walletAddress: string, signature: string) =>
    apiFetch<{ id: string; walletAddress: string }>("/auth/wallet/link", {
      method: "POST",
      body: JSON.stringify({ walletAddress, signature }),
    }),

  /**
   * DELETE /auth/wallet/disconnect
   * Remove wallet from account. Requires auth.
   */
  disconnectWalletFromAccount: () =>
    apiFetch<void>("/auth/wallet/disconnect", { method: "DELETE" }),
}

// ─────────────────────────────────────────────────────────
// User endpoints
// ─────────────────────────────────────────────────────────

/**
 * Backend UserProfileResponse shape (from GET /users/me and PATCH /users/me/profile):
 * {
 *   id, email, name, phoneNumber, avatarUrl, walletAddress,
 *   geographic: { primaryWard, primaryConstituency, primaryCounty, secondaryWard, currentLocation },
 *   verification: { level, emailVerified, phoneVerified, communityVerified },
 *   impact: { global, primary, allLocations, totals },
 *   economic: { utilityTokens, participationRights },
 *   industries: Array<{ id, name, isPrimary }>,
 *   metadata: { createdAt, lastLoginAt }
 * }
 */

// ─────────────────────────────────────────────────────────
// WebAuthn / Passkeys API
// ─────────────────────────────────────────────────────────

export const webAuthnApi = {
  /** POST /auth/webauthn/register/options — generate registration options (authenticated) */
  getRegistrationOptions: () =>
    apiFetch<PublicKeyCredentialCreationOptionsJSON>('/auth/webauthn/register/options', {
      method: 'POST',
    }),

  /** POST /auth/webauthn/register/verify — verify and store new passkey (authenticated) */
  verifyRegistration: (response: RegistrationResponseJSON, credentialName?: string) =>
    apiFetch<{ credentialId: string; credentialName: string | null }>(
      '/auth/webauthn/register/verify',
      {
        method: 'POST',
        body: JSON.stringify({ response, credentialName }),
      }
    ),

  /** POST /auth/webauthn/login/options — get authentication options (unauthenticated) */
  getLoginOptions: (email: string) =>
    apiFetch<PublicKeyCredentialRequestOptionsJSON>('/auth/webauthn/login/options', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  /** POST /auth/webauthn/login/verify — verify passkey and return sessionToken (unauthenticated) */
  verifyLogin: (email: string, response: AuthenticationResponseJSON) =>
    apiFetch<{ sessionToken: string }>('/auth/webauthn/login/verify', {
      method: 'POST',
      body: JSON.stringify({ email, response }),
    }),

  /** GET /auth/webauthn/credentials — list passkeys (authenticated) */
  listCredentials: () =>
    apiFetch<
      {
        id: string
        credentialName: string | null
        createdAt: string
        lastUsedAt: string
        transports: string[]
      }[]
    >('/auth/webauthn/credentials'),

  /** DELETE /auth/webauthn/credentials/:id — remove a passkey (authenticated) */
  deleteCredential: (id: string) =>
    apiFetch<null>(`/auth/webauthn/credentials/${id}`, { method: 'DELETE' }),
}

export const userApi = {
  /**
   * GET /users/me
   * Get current user's full profile. Requires EMAIL_VERIFIED.
   * Returns UserProfileResponse (see shape above).
   */
  getMe: () => apiFetch<any>("/users/me"),

  /**
   * PATCH /users/me/profile
   * Update profile. Requires EMAIL_VERIFIED.
   * Accepted fields: name, avatarUrl, privacySettings, accessibility
   * Returns updated UserProfileResponse.
   */
  updateProfile: (data: {
    name?: string
    avatarUrl?: string
    privacySettings?: {
      profileVisibility?: "PUBLIC" | "FRIENDS" | "PRIVATE"
      showEmail?: boolean
      showPhone?: boolean
      showWallet?: boolean
      showImpactPoints?: boolean
      allowDirectMessages?: boolean
      allowMarketplace?: boolean
      dataProcessingConsent?: boolean
    }
    accessibility?: {
      visualImpairment?: boolean
      hearingImpairment?: boolean
      motorImpairment?: boolean
      cognitiveImpairment?: boolean
      preferredLanguage?: string
      screenReaderEnabled?: boolean
      highContrast?: boolean
      fontSize?: "SMALL" | "MEDIUM" | "LARGE" | "XLARGE"
    }
  }) =>
    apiFetch<any>("/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /**
   * DELETE /users/me
   * Permanently delete account. Requires EMAIL_VERIFIED.
   */
  deleteAccount: () => apiFetch<void>("/users/me", { method: "DELETE" }),

  // ── Industries ───────────────────────────────────────────

  /**
   * GET /users/me/industries
   * Get selected industries. Requires COMMUNITY_VERIFIED.
   */
  getMyIndustries: () => apiFetch<Array<{ id: string; name: string; isPrimary: boolean }>>("/users/me/industries"),

  /**
   * POST /users/me/industries
   * Set user industries (1-3). Requires COMMUNITY_VERIFIED.
   */
  selectIndustries: (industryIds: string[], primaryIndustryId?: string) =>
    apiFetch<void>("/users/me/industries", {
      method: "POST",
      body: JSON.stringify({ industryIds, primaryIndustryId }),
    }),

  // ── Goods & Services ──────────────────────────────────────

  /**
   * GET /users/me/goods-services
   * Get selected goods/services. Requires COMMUNITY_VERIFIED.
   */
  getMyGoodsServices: () =>
    apiFetch<Array<{ id: string; name: string; canProvide: boolean; canRequest: boolean }>>("/users/me/goods-services"),

  /**
   * POST /users/me/goods-services
   * Set goods/services (1-20). canProvide and canRequest must be same length as goodsServiceIds.
   * Requires COMMUNITY_VERIFIED.
   */
  selectGoodsServices: (
    items: Array<{ id: string; canProvide: boolean; canRequest: boolean }>
  ) =>
    apiFetch<void>("/users/me/goods-services", {
      method: "POST",
      body: JSON.stringify({
        goodsServiceIds: items.map((i) => i.id),
        canProvide: items.map((i) => i.canProvide),
        canRequest: items.map((i) => i.canRequest),
      }),
    }),

  // ── Reference / Lookup ───────────────────────────────────

  /**
   * GET /users/reference/industries
   * List all industries. No auth required.
   */
  getIndustries: () => apiFetch<Array<{ id: string; name: string }>>("/users/reference/industries"),

  /**
   * GET /users/reference/goods-services?industryId=...
   * List goods/services optionally filtered by industry. No auth required.
   */
  getGoodsServices: (industryId?: string) => {
    const qs = industryId ? `?industryId=${industryId}` : ""
    return apiFetch<Array<{ id: string; name: string; industryId: string }>>(`/users/reference/goods-services${qs}`)
  },

  /**
   * GET /users/reference/counties
   */
  getCounties: () => apiFetch<Array<{ id: string; name: string }>>("/users/reference/counties"),

  /**
   * GET /users/reference/constituencies?countyId=...
   */
  getConstituencies: (countyId?: string) => {
    const qs = countyId ? `?countyId=${countyId}` : ""
    return apiFetch<Array<{ id: string; name: string; countyId: string }>>(`/users/reference/constituencies${qs}`)
  },

  /**
   * GET /users/reference/wards?constituencyId=...
   */
  getWards: (constituencyId?: string) => {
    const qs = constituencyId ? `?constituencyId=${constituencyId}` : ""
    return apiFetch<Array<{ id: string; name: string; constituencyId: string }>>(`/users/reference/wards${qs}`)
  },

  /**
   * GET /users/wards/:wardId/members
   * Ward members for vouching. Requires PHONE_VERIFIED.
   */
  getWardMembers: (wardId: string) =>
    apiFetch<Array<{ id: string; name: string; verificationLevel: string }>>(`/users/wards/${wardId}/members`),

  /**
   * GET /users/:userId
   * View another user's public profile (privacy-filtered). Requires COMMUNITY_VERIFIED.
   */
  getUserProfile: (userId: string) => apiFetch<any>(`/users/${userId}`),

  // ── Residence & Location ──────────────────────────────────

  /**
   * POST /users/me/request-residence-change
   * Request a ward residence change (6-month cooldown, costs 50 PR).
   * Requires COMMUNITY_VERIFIED.
   */
  requestResidenceChange: (data: {
    newPrimaryWardId: string
    reason?: string
    proofUrl?: string
  }) =>
    apiFetch<void>("/users/me/request-residence-change", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * GET /users/me/residence-change-requests
   * List pending residence change requests. Requires COMMUNITY_VERIFIED.
   */
  getResidenceChangeRequests: () => apiFetch<any[]>("/users/me/residence-change-requests"),

  /**
   * POST /users/me/temporary-location
   * Set temporary location (max 6 months). Requires COMMUNITY_VERIFIED.
   */
  setTemporaryLocation: (wardId: string, until: string) =>
    apiFetch<void>("/users/me/temporary-location", {
      method: "POST",
      body: JSON.stringify({ wardId, until }),
    }),

  /**
   * DELETE /users/me/temporary-location
   * Clear temporary location. Requires COMMUNITY_VERIFIED.
   */
  clearTemporaryLocation: () =>
    apiFetch<void>("/users/me/temporary-location", { method: "DELETE" }),

  // ── Privacy & Accessibility ───────────────────────────────

  /**
   * GET /users/me/privacy-settings
   * Get privacy settings. Requires COMMUNITY_VERIFIED.
   */
  getPrivacySettings: () =>
    apiFetch<{
      profileVisibility: string
      showEmail: boolean
      showPhone: boolean
      showWallet: boolean
      showImpactPoints: boolean
      allowDirectMessages: boolean
      allowMarketplace: boolean
      dataProcessingConsent: boolean
    }>("/users/me/privacy-settings"),

  /**
   * GET /users/me/accessibility
   * Get accessibility settings. Requires COMMUNITY_VERIFIED.
   */
  getAccessibilitySettings: () =>
    apiFetch<{
      visualImpairment: boolean
      hearingImpairment: boolean
      motorImpairment: boolean
      cognitiveImpairment: boolean
      preferredLanguage: string
      screenReaderEnabled: boolean
      highContrast: boolean
      fontSize: string
    }>("/users/me/accessibility"),

  // ── Community Verification ────────────────────────────────

  /**
   * POST /users/verify-community/request
   * Request community verification (3 vouches needed). Requires PHONE_VERIFIED.
   */
  requestCommunityVerification: () =>
    apiFetch<{ requestId: string; status: string; expiresAt: string; vouchesNeeded: number }>(
      "/users/verify-community/request",
      { method: "POST" }
    ),

  /**
   * POST /users/verify-community/vouch
   * Vouch for another user. Requires COMMUNITY_VERIFIED. Max 5/day.
   */
  vouchForUser: (targetUserId: string, wardId: string) =>
    apiFetch<void>("/users/verify-community/vouch", {
      method: "POST",
      body: JSON.stringify({ targetUserId, wardId }),
    }),

  /**
   * POST /users/verify-community/payment
   * Fallback: pay KES 100 for verification. Requires PHONE_VERIFIED.
   */
  payForVerification: (transactionId: string) =>
    apiFetch<void>("/users/verify-community/payment", {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    }),

  /**
   * GET /users/verify-community/status
   * Check community verification progress. Requires PHONE_VERIFIED.
   */
  getVerificationStatus: () =>
    apiFetch<{
      status: "PENDING" | "VOUCHING" | "PAYMENT_PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
      vouchesReceived: number
      vouchesNeeded: number
      expiresAt?: string | null
      rejectionReason?: string | null
    }>("/users/verify-community/status"),
}

// ─────────────────────────────────────────────────────────
// Economy endpoints (available after COMMUNITY_VERIFIED)
// ─────────────────────────────────────────────────────────

export const economyApi = {
  /**
   * GET /economy/pr
   * Get PR balance + recent history.
   * Returns: { balance: number, history: Array<{ amount, balance, reason, createdAt }> }
   */
  getPRBalance: () =>
    apiFetch<{ balance: number; history: Array<{ amount: number; balance: number; reason: string; createdAt: string }> }>("/economy/pr"),

  /**
   * GET /economy/dues/history
   * Get dues payment history & totals.
   */
  getDuesHistory: () =>
    apiFetch<{
      payments: any[]
      totals: { totalPaidKes: number; totalPaidPR: number; completedCount: number }
    }>("/economy/dues/history"),

  /**
   * GET /economy/commitments
   * Get active & past commitments.
   */
  getCommitments: () => apiFetch<any[]>("/economy/commitments"),

  /**
   * POST /economy/commitments/dues
   * Opt-in to monthly dues commitment. Rate limited: 1 per month.
   */
  optInDuesCommitment: (data: {
    tier: "ORDINARY" | "SUPPORTER" | "SPONSOR"
    startPeriod?: string  // YYYY-MM format
    durationMonths?: number
  }) =>
    apiFetch<any>("/economy/commitments/dues", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * GET /economy/transactions
   * Transaction history (fiat-backed UT deposits, withdrawals).
   * Backend route exists but handler not yet implemented — returns 404 until wired.
   */
  getTransactions: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set("limit", String(params.limit))
    if (params?.offset) q.set("offset", String(params.offset))
    return apiFetch<{ transactions: any[]; total: number }>(
      `/economy/transactions${q.toString() ? `?${q}` : ""}`
    )
  },
}

// ─────────────────────────────────────────────────────────
// Integration API  — /api/v1/integration
// ─────────────────────────────────────────────────────────

export interface BarazaGroupDto {
  id: string
  groupId: string
  platform: "TELEGRAM" | "WHATSAPP" | "DISCORD"
  externalId: string
  name: string
  inviteLink: string | null
  isActive: boolean
  createdAt: string
}

export interface RegisterBarazaGroupDto {
  groupId: string
  platform: "TELEGRAM" | "WHATSAPP" | "DISCORD"
  externalId: string
  name: string
  inviteLink?: string
  metadata?: Record<string, unknown>
}

export interface BarazaSessionDto {
  id: string
  barazaGroupId: string
  scheduledAt: string
  openedAt: string | null
  closedAt: string | null
  createdBy: string
  createdAt: string
}

export const integrationApi = {
  getBarazaGroups: () =>
    apiFetch<BarazaGroupDto[]>("/integration/baraza-groups"),

  registerBarazaGroup: (dto: RegisterBarazaGroupDto) =>
    apiFetch<BarazaGroupDto>("/integration/baraza-groups", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  refreshInviteLink: (groupId: string) =>
    apiFetch<{ inviteLink: string }>(`/integration/baraza-groups/${groupId}/refresh-invite`, {
      method: "POST",
    }),

  recordAttendance: (
    groupId: string,
    dto: {
      sessionDate: string
      attendeeExternalIds: string[]
      facilitatorExternalId?: string
      reportedBy?: string
    }
  ) =>
    apiFetch<unknown>(`/integration/baraza-groups/${groupId}/attendance`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  deactivateBarazaGroup: (groupId: string) =>
    apiFetch<unknown>(`/integration/baraza-groups/${groupId}/deactivate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /** Admin only — all baraza groups across all wards */
  getAllBarazaGroups: () =>
    apiFetch<(BarazaGroupDto & { _count: { attendances: number } })[]>("/integration/baraza-groups/all"),

  getSessions: (barazaGroupId: string) =>
    apiFetch<BarazaSessionDto[]>(`/integration/baraza-groups/${barazaGroupId}/sessions`),

  scheduleSession: (barazaGroupId: string, scheduledAt: string) =>
    apiFetch<BarazaSessionDto>(`/integration/baraza-groups/${barazaGroupId}/sessions/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt }),
    }),

  openSession: (barazaGroupId: string) =>
    apiFetch<BarazaSessionDto>(`/integration/baraza-groups/${barazaGroupId}/sessions/open`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  closeSession: (barazaGroupId: string) =>
    apiFetch<{ session: BarazaSessionDto; attendanceCount: number }>(
      `/integration/baraza-groups/${barazaGroupId}/sessions/close`,
      { method: "POST", body: JSON.stringify({}) }
    ),
}

// ─────────────────────────────────────────────────────────
// Notifications API  — /api/v1/notifications
// ─────────────────────────────────────────────────────────

export interface NotificationDto {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  metadata?: Record<string, unknown>
}

export const notificationsApi = {
  getNotifications: (unreadOnly = false) =>
    apiFetch<NotificationDto[]>(`/notifications${unreadOnly ? "?unread=true" : ""}`),

  getUnreadCount: () =>
    apiFetch<{ count: number }>("/notifications/unread-count"),

  markRead: (notificationId: string) =>
    apiFetch<void>("/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ notificationId }),
    }),

  markAllRead: () =>
    apiFetch<void>("/notifications/mark-all-read", { method: "POST" }),

  getPreferences: () =>
    apiFetch<Array<{ channel: string; category: string; enabled: boolean }>>("/notifications/preferences"),

  updatePreference: (channel: string, category: string, enabled: boolean) =>
    apiFetch<void>("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ channel, category, enabled }),
    }),
}

// ─────────────────────────────────────────────────────────
// Community API  — /api/v1/community
// ─────────────────────────────────────────────────────────

export interface GroupDetailDto {
  groupId: string
  groupName: string
  description: string | null
  isSystem: boolean
  systemType: string | null
  voluntaryType: string | null
  locationScope: string | null
  memberCount: number
  createdAt: string
  ward: { id: string; name: string } | null
  constituency: { id: string; name: string } | null
  county: { id: string; name: string } | null
  userRole: string | null
  userJoinedAt: string | null
}

export interface GroupDiscoveryDto {
  id: string
  name: string
  description: string | null
  isSystemGroup: boolean
  systemType: string | null
  voluntaryType: string | null
  locationScope: string
  memberCount: number
  status: string
  isMember: boolean
  myRole: string | null
}

export interface GroupMembershipDto {
  groupId: string
  groupName: string
  systemType: string | null
  voluntaryType: string | null
  isSystem: boolean
  locationScope: string | null
  role: string
  joinedAt: string
  memberCount: number
  ward: { id: string; name: string } | null
  constituency: { id: string; name: string } | null
  county: { id: string; name: string } | null
}

export interface GroupMemberDto {
  userId: string
  userName: string
  avatarUrl: string | null
  verificationLevel: string
  participationRights: number
  role: string
  joinedAt: string
}

export const communityApi = {
  createVoluntaryGroup: (dto: {
    name: string
    voluntaryType: string
    description?: string
    avatarUrl?: string
  }) =>
    apiFetch<{ id: string; name: string; voluntaryType: string }>("/community/voluntary/create", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  joinGroup: (groupId: string) =>
    apiFetch<unknown>("/community/join", {
      method: "POST",
      body: JSON.stringify({ groupId }),
    }),

  leaveGroup: (groupId: string) =>
    apiFetch<unknown>("/community/leave", {
      method: "POST",
      body: JSON.stringify({ groupId }),
    }),

  getMyGroups: (): Promise<GroupMembershipDto[]> =>
    apiFetch<GroupMembershipDto[]>("/community/my-groups"),

  getGroups: (params?: {
    isSystem?: boolean
    voluntaryType?: string
    systemType?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ groups: GroupDiscoveryDto[]; total: number }> =>
    apiFetch<{ groups: GroupDiscoveryDto[]; total: number }>(`/community${buildQs(params)}`),

  getGroupDetail: (groupId: string): Promise<GroupDetailDto> =>
    apiFetch<GroupDetailDto>(`/community/${groupId}`),

  getMyRoleInGroup: (groupId: string): Promise<{ role: string | null }> =>
    apiFetch<{ role: string | null }>(`/community/${groupId}/my-role`),

  getGroupMembers: (groupId: string, limit = 50, offset = 0): Promise<GroupMemberDto[]> =>
    apiFetch<GroupMemberDto[]>(`/community/${groupId}/members?limit=${limit}&offset=${offset}`),

  updateGroupSettings: (groupId: string, dto: { name?: string; description?: string }) =>
    apiFetch<{ id: string; name: string; description: string | null }>(`/community/${groupId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    }),

  changeMemberRole: (groupId: string, userId: string, role: string) =>
    apiFetch<{ userId: string; role: string }>(`/community/${groupId}/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  removeMember: (groupId: string, userId: string) =>
    apiFetch<{ success: boolean }>(`/community/${groupId}/members/${userId}`, {
      method: "DELETE",
    }),

  dissolveGroup: (groupId: string, reason?: string) =>
    apiFetch<{ success: boolean; groupId: string; status: string }>(`/community/${groupId}/dissolve`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),

  getDeclaration: (groupId: string): Promise<{
    id: string
    groupId: string
    wardName: string
    registeredAt: string
    declarationText: string
    createdAt: string
  }> => apiFetch(`/community/${groupId}/declaration`),
}

// ─────────────────────────────────────────────────────────
// Governance API  — /api/v1/governance
// ─────────────────────────────────────────────────────────

export type ProposalStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED_FOR_VOTING"
  | "VOTING"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "COMPLETED"
  | "CANCELLED"

export type ProposalScope = "GROUP" | "COMMUNITY"

export interface ProposalDto {
  id: string
  title: string
  description: string
  proposalType: string
  status: ProposalStatus
  proposalScope: ProposalScope
  groupId: string | null
  creatorId: string
  budget: string | null
  groupFundingAmount: string | null
  locationFundingRequest: string | null
  reviewedById: string | null
  reviewNote: string | null
  votingStartsAt: string | null
  votingEndsAt: string | null
  createdAt: string
  updatedAt: string
  creator: { id: string; name: string; avatarUrl?: string } | null
  group: {
    id: string
    name: string
    locationScope?: string
    wardId?: string | null
    constituencyId?: string | null
    countyId?: string | null
    voluntaryType?: string | null
  } | null
  votesSummary?: { total: number; yesWeight: number; noWeight: number }
  _count?: { votes: number }
  // Ward Memory Layer
  rationale?: string | null
  alternatives?: string | null
  outcome?: string | null
  outcomeRecordedAt?: string | null
}

export const governanceApi = {
  createProposal: (dto: {
    groupId: string
    title: string
    description: string
    fundingAmountKes?: number
    isEmergency?: boolean
    proposalScope?: ProposalScope
    groupFundingAmount?: number
    locationFundingRequest?: number
  }) =>
    apiFetch<unknown>("/governance/create", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  startVoting: (proposalId: string) =>
    apiFetch<unknown>("/governance/start-voting", {
      method: "POST",
      body: JSON.stringify({ proposalId }),
    }),

  castVote: (dto: { proposalId: string; option: "YES" | "NO" | "ABSTAIN" }) =>
    apiFetch<unknown>("/governance/vote", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  tallyVotes: (proposalId: string) =>
    apiFetch<unknown>(`/governance/${proposalId}/tally`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getProposals: (params?: {
    groupId?: string
    scope?: ProposalScope
    status?: ProposalStatus
    limit?: number
    offset?: number
  }): Promise<{ proposals: ProposalDto[]; total: number; limit: number; offset: number }> =>
    apiFetch(`/governance${buildQs(params)}`),

  getProposal: (proposalId: string): Promise<ProposalDto> =>
    apiFetch<ProposalDto>(`/governance/${proposalId}`),

  reviewProposal: (proposalId: string, decision: "APPROVE" | "REJECT", note?: string) =>
    apiFetch<unknown>(`/governance/${proposalId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  getNeedsAction: (): Promise<{ proposals: ProposalDto[]; total: number }> =>
    apiFetch("/governance/needs-action"),

  updateMemory: (proposalId: string, dto: { rationale?: string; alternatives?: string }) =>
    apiFetch<{ id: string; rationale: string | null; alternatives: string | null }>(
      `/governance/${proposalId}/memory`,
      { method: "PATCH", body: JSON.stringify(dto) }
    ),

  recordOutcome: (proposalId: string, outcome: string) =>
    apiFetch<{ id: string; outcome: string; outcomeRecordedAt: string }>(
      `/governance/${proposalId}/outcome`,
      { method: "PATCH", body: JSON.stringify({ outcome }) }
    ),

  cancelProposal: (proposalId: string) =>
    apiFetch<unknown>(`/governance/${proposalId}/cancel`, { method: "POST" }),

  updateProgress: (proposalId: string, status: "EXECUTING" | "COMPLETED", note?: string) =>
    apiFetch<unknown>(`/governance/${proposalId}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),

}

// ─────────────────────────────────────────────────────────
// Projects API
// ─────────────────────────────────────────────────────────

export const SKILL_CATEGORIES = [
  "GENERAL", "CONSTRUCTION", "MASONRY", "ELECTRICAL", "PLUMBING",
  "CARPENTRY", "PAINTING", "FARMING", "TRANSPORT", "ADMINISTRATION",
  "TECHNOLOGY", "HEALTH", "EDUCATION", "FINANCE",
] as const
export type SkillCategory = (typeof SKILL_CATEGORIES)[number]

export interface TaskDto {
  id: string
  projectId: string | null
  milestoneId: string
  title: string
  description: string | null
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED"
  skillCategory: string | null
  maxAssignees: number
  dueDate: string | null
  assignedTo: { id: string; name: string | null; avatarUrl: string | null } | null
  createdAt: string
  updatedAt: string
}

export interface MemberContributionDto {
  userId: string
  user: { id: string; name: string | null; avatarUrl: string | null }
  role: string
  tasksCompleted: number
  tasksInProgress: number
  hoursLogged: number
  sessionsAttended: number
  impactPointsEarned: number
}

export interface ProjectMilestoneDto {
  id: string
  projectId: string
  title: string
  description: string | null
  status: "PENDING" | "IN_PROGRESS" | "AWAITING_VERIFICATION" | "VERIFIED" | "REJECTED"
  dueDate: string | null
  orderIndex: number
  proposalMilestoneId: string | null
  tasks: TaskDto[]
  createdAt: string
  updatedAt: string
}

export interface ProjectListItemDto {
  id: string
  title: string
  description: string | null
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "CANCELLED" | "COMPLETED"
  ownerGroupId: string | null
  ownerUserId: string | null
  proposalId: string | null
  milestonesCount: number
  completedMilestonesCount: number
  createdAt: string
  updatedAt: string
}

export interface ProjectDetailDto extends ProjectListItemDto {
  milestones: ProjectMilestoneDto[]
  members: Array<{
    userId: string
    role: string
    joinedAt: string
    user: { id: string; name: string | null; avatarUrl: string | null }
  }>
  ownerGroup: { id: string; name: string } | null
  ownerUser: { id: string; name: string | null; avatarUrl: string | null } | null
  proposal: { id: string; title: string; status: string } | null
}

export interface WorkPresenceDto {
  id: string
  sessionId: string
  userId: string
  user: { id: string; name: string | null; avatarUrl: string | null }
  attestedById: string | null
  depth: number
  ipAwarded: number
  awardedAt: string | null
  createdAt: string
}

export interface WorkSessionDto {
  id: string
  milestoneId: string
  projectId: string
  qrSecret: string
  status: "OPEN" | "APPROVED" | "FLAGGED"
  expiresAt: string
  closedAt: string | null
  presenceCount: number
  presences: WorkPresenceDto[]
  createdAt: string
}

export interface ScanQrResponseDto {
  sessionId: string
  depth: number
  expiresAt: string
  attestationsRemaining: number
}

export interface WorkLogResponseDto {
  id: string
  milestoneId: string
  projectId: string
  userId: string
  worker: { id: string; name: string | null; avatarUrl: string | null }
  workType: "MANUAL_LABOR" | "SKILLED_WORK" | "SUPERVISION"
  description: string
  hours: number
  photoUrls: string[]
  status: "PENDING" | "APPROVED" | "REJECTED"
  totalIPEarned: number
  verifiedAt: string | null
  createdAt: string
}

export const projectApi = {
  getProjects: (params?: {
    ownerGroupId?: string
    ownerUserId?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ projects: ProjectListItemDto[]; total: number; limit: number; offset: number }> =>
    apiFetch(`/projects${buildQs(params)}`),

  getProject: (id: string): Promise<ProjectDetailDto> =>
    apiFetch<ProjectDetailDto>(`/projects/${id}`),

  createFromProposal: (proposalId: string) =>
    apiFetch<unknown>("/projects/from-proposal", {
      method: "POST",
      body: JSON.stringify({ proposalId }),
    }),

  startMilestone: (milestoneId: string) =>
    apiFetch<unknown>("/projects/milestone/start", {
      method: "POST",
      body: JSON.stringify({ milestoneId }),
    }),

  submitMilestone: (dto: { milestoneId: string; proofUrl: string; description: string }) =>
    apiFetch<unknown>("/projects/milestone/submit", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  verifyMilestone: (dto: { milestoneId: string; approved: boolean; feedback?: string }) =>
    apiFetch<unknown>("/projects/milestone/verify", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  logWork: (dto: {
    milestoneId: string
    workType: "MANUAL_LABOR" | "SKILLED_WORK" | "SUPERVISION"
    description: string
    hours: number
    photoUrls?: string[]
    witnessIds?: string[]
  }): Promise<WorkLogResponseDto> =>
    apiFetch<WorkLogResponseDto>("/projects/work-log", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  verifyWork: (dto: { workLogId: string; approved: boolean; feedback?: string }): Promise<WorkLogResponseDto> =>
    apiFetch<WorkLogResponseDto>("/projects/work-log/verify", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  getWorkLogs: (milestoneId: string): Promise<{ workLogs: WorkLogResponseDto[]; total: number }> =>
    apiFetch(`/projects/milestone/${milestoneId}/work-logs`),

  joinProject: (projectId: string): Promise<{ projectId: string; userId: string; role: string }> =>
    apiFetch(`/projects/${projectId}/join`, { method: "POST" }),

  contribute: (projectId: string, amount: number): Promise<{ newBalance: number }> =>
    apiFetch(`/projects/${projectId}/contribute`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  createTask: (dto: {
    milestoneId: string
    title: string
    description?: string
    skillCategory?: SkillCategory
    maxAssignees?: number
    dueDate?: string
  }): Promise<TaskDto> =>
    apiFetch<TaskDto>("/projects/tasks", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  listProjectTasks: (
    projectId: string,
    filters?: { status?: string; skillCategory?: string }
  ): Promise<{ tasks: TaskDto[]; total: number }> => {
    const q = new URLSearchParams()
    if (filters?.status) q.set("status", filters.status)
    if (filters?.skillCategory) q.set("skillCategory", filters.skillCategory)
    return apiFetch(`/projects/${projectId}/tasks${q.toString() ? `?${q}` : ""}`)
  },

  getMemberContributions: (projectId: string): Promise<MemberContributionDto[]> =>
    apiFetch(`/projects/${projectId}/contributions`),

  claimTask: (taskId: string): Promise<unknown> =>
    apiFetch(`/projects/tasks/${taskId}/claim`, { method: "POST" }),

  completeTask: (taskId: string): Promise<unknown> =>
    apiFetch(`/projects/tasks/${taskId}/done`, { method: "PATCH" }),

  createWorkSession: (dto: { milestoneId: string; durationMinutes: number }): Promise<WorkSessionDto> =>
    apiFetch("/projects/work-sessions", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  scanQr: (qrSecret: string): Promise<ScanQrResponseDto> =>
    apiFetch("/projects/work-sessions/scan", {
      method: "POST",
      body: JSON.stringify({ qrSecret }),
    }),

  attestPresence: (sessionId: string, targetUserId: string): Promise<{ sessionId: string; targetUserId: string; depth: number }> =>
    apiFetch(`/projects/work-sessions/${sessionId}/attest`, {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    }),

  closeWorkSession: (sessionId: string): Promise<{ sessionId: string; status: "APPROVED" | "FLAGGED"; presenceCount: number }> =>
    apiFetch(`/projects/work-sessions/${sessionId}/close`, { method: "POST" }),

  getWorkSession: (sessionId: string): Promise<WorkSessionDto> =>
    apiFetch(`/projects/work-sessions/${sessionId}`),
}

// ─────────────────────────────────────────────────────────
// Education API  — /api/v1/education
// ─────────────────────────────────────────────────────────

export interface EducationModuleDto {
  id: string
  title: string
  description: string
  content: string
  mediaUrls: string[]
  duration: number
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT"
  category: string
  verified: boolean
  completionIP: number
  views: number
  averageRating: number
  createdAt: string
  creator: { id: string; name: string | null }
  _count?: { progress: number; reviews: number }
}

export interface EducationModuleDetailDto extends EducationModuleDto {
  assessment: {
    id: string
    passingScore: number
    maxAttempts: number
    questions: unknown
  } | null
  userProgress: {
    status: string
    progress: number
    score: number | null
    startedAt: string
    completedAt: string | null
  } | null
}

export interface EducationProgressDto {
  id: string
  userId: string
  moduleId: string
  status: string
  progress: number
  score: number | null
  startedAt: string
  completedAt: string | null
  ipAwarded?: number
}

export interface EducationReviewDto {
  id: string
  moduleId: string
  userId: string
  rating: number
  comment: string | null
  helpful: number
  createdAt: string
}

export const educationApi = {
  getModules: (params?: {
    category?: string
    difficulty?: string
    limit?: number
    offset?: number
  }): Promise<{ modules: EducationModuleDto[]; total: number; limit: number; offset: number }> =>
    apiFetch(`/education${buildQs(params)}`),

  getModule: (moduleId: string): Promise<EducationModuleDetailDto> =>
    apiFetch<EducationModuleDetailDto>(`/education/${moduleId}`),

  startModule: (moduleId: string): Promise<EducationProgressDto> =>
    apiFetch<EducationProgressDto>(`/education/${moduleId}/start`, { method: "POST" }),

  completeModule: (moduleId: string, score?: number): Promise<EducationProgressDto> =>
    apiFetch<EducationProgressDto>(`/education/${moduleId}/complete`, {
      method: "POST",
      body: JSON.stringify(score !== undefined ? { score } : {}),
    }),

  submitReview: (moduleId: string, dto: { rating: number; comment?: string }): Promise<EducationReviewDto> =>
    apiFetch<EducationReviewDto>(`/education/${moduleId}/review`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),
}

// ─────────────────────────────────────────────────────────
// Legacy compat — keep apiClient export so existing code doesn't break
// while we migrate page by page.
// ─────────────────────────────────────────────────────────

class ApiClient {
  setToken(_token: string | null) {
    // no-op — tokens are managed by tokenStore now
  }

  async getMe() {
    return userApi.getMe()
  }

  async updateProfile(data: any) {
    return userApi.updateProfile(data)
  }

  // Delegates to notificationsApi; maps backend DTO → frontend Notification shape
  async getNotifications(): Promise<any[]> {
    try {
      const dtos = await notificationsApi.getNotifications()
      return dtos.map((n) => {
        const meta = (n.metadata ?? {}) as Record<string, string>
        let actionUrl: string | undefined
        let actionLabel: string | undefined
        if (n.type === "PROPOSAL" && meta.proposalId) {
          actionUrl = `/governance/${meta.proposalId}`
          actionLabel = "View proposal"
        } else if (n.type === "ECONOMIC") {
          actionUrl = "/economy"
          actionLabel = "View economy"
        } else if (n.type === "PROJECT" && meta.projectId) {
          actionUrl = `/projects/${meta.projectId}`
          actionLabel = "View project"
        }
        return {
          ...n,
          read: n.isRead,
          userId: "",
          category: "system",
          channels: [],
          deliveryStatus: {},
          actionUrl,
          actionLabel,
        }
      })
    } catch {
      return []
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    await notificationsApi.markRead(id)
  }

  async getNotificationPreferences(): Promise<any> {
    try {
      return await notificationsApi.getPreferences()
    } catch {
      return []
    }
  }

  async updateNotificationPreferences(preferences: { channel: string; category: string; enabled: boolean }): Promise<any> {
    await notificationsApi.updatePreference(
      preferences.channel,
      preferences.category,
      preferences.enabled
    )
    return preferences
  }

  async getGroups(): Promise<any[]> {
    try {
      const memberships = await communityApi.getMyGroups()
      return memberships.map((m) => ({
        id: m.groupId,
        name: m.groupName,
        description: m.isSystem
          ? `${m.systemType?.charAt(0) + (m.systemType?.slice(1).toLowerCase() ?? "")} community group`
          : m.voluntaryType?.replace(/_/g, " ").toLowerCase() ?? "",
        memberCount: m.memberCount,
        userRole: m.role,
        isPrivate: false,
        avatar: undefined as string | undefined,
      }))
    } catch {
      return []
    }
  }

  async getGroup(id: string): Promise<GroupDetailDto | null> {
    try {
      return await communityApi.getGroupDetail(id)
    } catch {
      return null
    }
  }

  async getGroupMembers(id: string): Promise<any[]> {
    try {
      return await communityApi.getGroupMembers(id)
    } catch {
      return []
    }
  }

  async getProposals(_filters?: any): Promise<any[]> {
    try {
      const { proposals } = await governanceApi.getProposals()
      const STATUS_MAP: Record<string, string> = {
        DRAFT: "draft",
        VOTING: "active",
        APPROVED: "passed",
        REJECTED: "rejected",
        EXECUTING: "active",
        COMPLETED: "passed",
        CANCELLED: "rejected",
      }
      return proposals.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        purpose: "nonprofit" as const,
        locationScope: (p.group?.locationScope?.toLowerCase() ?? "local") as any,
        isPrivate: false,
        status: (STATUS_MAP[p.status] ?? p.status.toLowerCase()) as any,
        createdBy: { id: p.creatorId, name: p.creator?.name ?? "Unknown" },
        groupId: p.groupId ?? undefined,
        groupName: p.group?.name ?? undefined,
        votingDeadline: p.votingEndsAt ?? new Date().toISOString(),
        tokenCost: 0,
        impactPointsRequired: 0,
        votingStats: {
          totalVotes: p._count?.votes ?? p.votesSummary?.total ?? 0,
          yesVotes: 0,
          noVotes: 0,
          abstainVotes: 0,
          quorumRequired: 40,
          consensusRequired: 50,
          currentQuorum: 0,
          currentConsensus: 0,
        },
        userVote: undefined,
        canVote: false,
        canEdit: false,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
    } catch {
      return []
    }
  }

  async getUserGroups(): Promise<any[]> {
    try {
      return await communityApi.getMyGroups()
    } catch {
      return []
    }
  }

  async createProposal(_data: any): Promise<any> {
    return null
  }

  async voteOnProposal(proposalId: string, vote: string): Promise<void> {
    await governanceApi.castVote({
      proposalId,
      option: vote.toUpperCase() as "YES" | "NO" | "ABSTAIN",
    })
  }

  async getUserVotes(): Promise<any[]> {
    return []
  }
}

export const apiClient = new ApiClient()

// ─────────────────────────────────────────────────────────
// Admin types
// ─────────────────────────────────────────────────────────

export interface AdminStatsDto {
  users: {
    total: number
    active: number
    suspended: number
    byVerification: Record<string, number>
  }
  governance: { activeProposals: number }
  pendingActions: { verifications: number; residenceChanges: number; total: number }
  economy: { totalParticipationRights: number; totalUtilityTokens: number }
}

export interface AdminUserDto {
  id: string
  name: string | null
  email: string | null
  status: string
  verificationLevel: string
  roles: string[]
  county: string | null
  constituency: string | null
  participationRights: number
  globalImpactPoints: number
  createdAt: string
  lastLoginAt: string | null
}

export interface AdminConfigItemDto {
  id: string
  key: string
  value: string
  category: string
  dataType: string
  updatedAt: string
}

export interface AuditLogDto {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, any> | null
  createdAt: string
  user: { id: string; name: string | null; email: string | null } | null
}

// ─────────────────────────────────────────────────────────
// adminApi
// ─────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () =>
    apiFetch<AdminStatsDto>("/admin/stats"),

  getUsers: (params?: { search?: string; status?: string; verificationLevel?: string; limit?: number; offset?: number }) =>
    apiFetch<{ users: AdminUserDto[]; total: number; limit: number; offset: number }>(`/admin/users${buildQs(params)}`),

  getConfig: () =>
    apiFetch<AdminConfigItemDto[]>("/admin/config"),

  updateConfig: (key: string, value: string) =>
    apiFetch<AdminConfigItemDto>("/admin/config/update", {
      method: "POST",
      body: JSON.stringify({ key, value }),
    }),

  suspendUser: (userId: string, body: { suspend: boolean; reason: string; durationDays?: number }) =>
    apiFetch<{ suspended: boolean }>(`/admin/users/${userId}/suspend`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getPendingVerifications: (params?: { page?: number; pageSize?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set("page", String(params.page))
    if (params?.pageSize) q.set("pageSize", String(params.pageSize))
    const qs = q.toString()
    return apiFetch<{ requests: any[]; pagination: { total: number } }>(`/admin/verification/community/pending${qs ? `?${qs}` : ""}`)
  },

  getPendingResidenceChanges: (params?: { page?: number; pageSize?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set("page", String(params.page))
    if (params?.pageSize) q.set("pageSize", String(params.pageSize))
    const qs = q.toString()
    return apiFetch<{ requests: any[]; pagination: { total: number } }>(`/admin/residence/pending${qs ? `?${qs}` : ""}`)
  },

  assignRole: (userId: string, role: string, scope?: string) =>
    apiFetch<null>(`/admin/users/${userId}/roles`, {
      method: "POST",
      body: JSON.stringify({ role, scope }),
    }),

  revokeRole: (userId: string, role: string) =>
    apiFetch<null>(`/admin/users/${userId}/roles/${encodeURIComponent(role)}`, {
      method: "DELETE",
    }),

  getUserRoles: (userId: string) =>
    apiFetch<{ role: string; description: string | null; grantedBy: string | null }[]>(`/admin/users/${userId}/roles`),

  generateReport: (
    type: "users" | "governance" | "economy",
    params?: { fromDate?: string; toDate?: string; format?: "json" | "csv" }
  ) => {
    const q = new URLSearchParams()
    if (params?.fromDate) q.set("fromDate", params.fromDate)
    if (params?.toDate) q.set("toDate", params.toDate)
    if (params?.format) q.set("format", params.format)
    const qs = q.toString()
    return apiFetch<any>(`/admin/reports/${type}${qs ? `?${qs}` : ""}`)
  },
}

// ─────────────────────────────────────────────────────────
// Marketplace API  — /api/v1/marketplace
// ─────────────────────────────────────────────────────────

export interface MarketplaceListingDto {
  id: string
  title: string
  description: string
  listingType: "OFFER" | "REQUEST"
  price: number
  quantity: number
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  sellerUserId: string
  sellerUser?: { id: string; name: string | null; phoneNumber: string | null; email?: string | null }
}

export interface MarketplacePaginatedDto {
  listings: MarketplaceListingDto[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const marketplaceApi = {
  searchListings: (params?: { type?: "OFFER" | "REQUEST"; wardId?: string; limit?: number; page?: number }) =>
    apiFetch<MarketplacePaginatedDto>(`/marketplace/search${buildQs(params)}`),

  getListing: (listingId: string) =>
    apiFetch<MarketplaceListingDto>(`/marketplace/${listingId}`),

  getMyListings: (params?: { limit?: number; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set("limit", String(params.limit))
    if (params?.page) q.set("page", String(params.page))
    const qs = q.toString()
    return apiFetch<MarketplacePaginatedDto>(`/marketplace/my-listings${qs ? `?${qs}` : ""}`)
  },

  createListing: (dto: { title: string; description: string; type: "OFFER" | "REQUEST"; priceGuideKes?: number; quantity?: number }) =>
    apiFetch<MarketplaceListingDto>("/marketplace/create", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  deactivateListing: (listingId: string) =>
    apiFetch<MarketplaceListingDto>(`/marketplace/${listingId}/deactivate`, {
      method: "PATCH",
      body: JSON.stringify({}),
    }),
}

// ─────────────────────────────────────────────────────────
// Emergency API  — /api/v1/emergency
// ─────────────────────────────────────────────────────────

export interface EmergencyAlertDto {
  id: string
  emergencyType: "FIRE" | "FLOOD" | "MEDICAL" | "SECURITY" | "ACCIDENT" | "OTHER"
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  title: string
  description: string
  location: string
  status: string
  createdAt: string
  reporterId: string
  reporter?: { id: string; name: string | null }
  _count?: { responses: number }
}

export const emergencyApi = {
  listAlerts: (params?: { wardId?: string; type?: string; status?: string; limit?: number; page?: number }) =>
    apiFetch<{ alerts: EmergencyAlertDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/emergency${buildQs(params)}`),

  getAlert: (alertId: string) =>
    apiFetch<EmergencyAlertDto>(`/emergency/${alertId}`),

  reportEmergency: (dto: { type: EmergencyAlertDto["emergencyType"]; description: string; locationWardId: string; latitude?: number; longitude?: number; photoUrl?: string }) =>
    apiFetch<EmergencyAlertDto>("/emergency/report", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  respondToEmergency: (alertId: string, message: string) =>
    apiFetch<unknown>(`/emergency/${alertId}/respond`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  updateAlertStatus: (alertId: string, status: "IN_PROGRESS" | "RESOLVED" | "FALSE_ALARM", statusNote?: string) =>
    apiFetch<EmergencyAlertDto>(`/emergency/${alertId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, statusNote }),
    }),
}

// ─────────────────────────────────────────────────────────
// Onboarding API  — /api/v1/onboarding
// ─────────────────────────────────────────────────────────

export interface OnboardingProgressDto {
  id: string
  userId: string
  emailVerified: boolean
  profileCompleted: boolean
  industriesSelected: boolean
  goodsServicesSelected: boolean
  joinedWardGroup: boolean
  castFirstVote: boolean
  phoneVerified: boolean
  communityVerified: boolean
  currentStep: string
  totalIPEarned: number
  totalPREarned: number
}

export interface OnboardingTutorialDto {
  key: string
  title: string
  requiredFor: string | null
  ipReward: number
  prReward: number
}

export const onboardingApi = {
  getProgress: () =>
    apiFetch<{
      progress: OnboardingProgressDto | null
      tutorials: OnboardingTutorialDto[]
      completions: { tutorialId: string; completed: boolean; ipEarned: number; prEarned: number; tutorial: { key: string } }[]
      milestones: { milestoneKey: string; achieved: boolean }[]
    }>("/onboarding/progress"),

  completeTutorial: (tutorialKey: string) =>
    apiFetch<{ id: string; completed: boolean; prEarned: number; ipEarned: number }>(
      `/onboarding/tutorial/${tutorialKey}/complete`,
      { method: "POST" }
    ),

  markMilestone: (milestoneKey: string) =>
    apiFetch<{ id: string; milestoneKey: string; achievedAt: string }>(
      "/onboarding/milestone",
      { method: "POST", body: JSON.stringify({ milestoneKey }) }
    ),
}

// ─────────────────────────────────────────────────────────
// Reputation API  — /api/v1/reputation
// ─────────────────────────────────────────────────────────

export interface WardReputationBreakdownDto {
  wardId: string
  ward: string
  constituency: string
  county: string
  points: number
  tier: "NONE" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM"
}

export interface ImpactPointLogDto {
  id: string
  amount: number
  reason: string
  scope: string
  createdAt: string
}

export const reputationApi = {
  getMyReputation: () =>
    apiFetch<{
      globalImpactPoints: number
      breakdown: WardReputationBreakdownDto[]
      totals: { locations: number; totalPoints: number }
    }>("/reputation/me"),

  getMyHistory: (params?: { limit?: number; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set("limit", String(params.limit))
    if (params?.page) q.set("page", String(params.page))
    const qs = q.toString()
    return apiFetch<{
      logs: ImpactPointLogDto[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/reputation/me/history${qs ? `?${qs}` : ""}`)
  },

  getUserReputation: (userId: string) =>
    apiFetch<{
      userId: string
      name: string | null
      globalImpactPoints: number
      breakdown: WardReputationBreakdownDto[]
      totals: { locations: number; totalPoints: number }
    }>(`/reputation/${userId}`),
}

// ─────────────────────────────────────────────────────────
// auditApi
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// Treasury API  — /api/v1/treasury
// ─────────────────────────────────────────────────────────

export interface TreasuryDto {
  id:           string
  groupId:      string
  groupName:    string
  balance:      number   // KES fiat balance
  tokenBalance: number   // UT token balance
  createdAt:    string
  updatedAt:    string
}

export interface WalletTransactionDto {
  id:              string
  treasuryId:      string
  amount:          number
  currency:        string
  transactionType: "CREDIT" | "DEBIT"
  description:     string | null
  referenceType:   string   // "DUES" | "MANUAL" | "PROJECT" | "PROPOSAL"
  createdAt:       string
  proposalId:      string | null
  projectId:       string | null
  initiatedById:   string
  metadata:        Record<string, unknown> | null
}

export interface MyGroupTreasuryDto {
  groupId:      string
  groupName:    string
  isSystem:     boolean
  systemType:   string | null
  balance:      number
  tokenBalance: number
  updatedAt:    string
}

export const treasuryApi = {
  /** GET /treasury/my-groups — balance summary for all groups the user belongs to */
  getMyGroups: () =>
    apiFetch<MyGroupTreasuryDto[]>('/treasury/my-groups'),

  /** GET /treasury/:groupId — balance + metadata (any authenticated member) */
  getTreasury: (groupId: string) =>
    apiFetch<TreasuryDto>(`/treasury/${groupId}`),

  /** GET /treasury/:groupId/transactions — paginated ledger */
  getTransactions: (groupId: string, params?: {
    page?:            number
    limit?:           number
    transactionType?: "CREDIT" | "DEBIT"
    referenceType?:   string
    fromDate?:        string
    toDate?:          string
  }) =>
    apiFetch<{
      transactions: WalletTransactionDto[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/treasury/${groupId}/transactions${buildQs(params)}`),
}

// ─────────────────────────────────────────────────────────
// Payments API  — /api/v1/payments
// ─────────────────────────────────────────────────────────

export type PaymentMethod  = "MPESA" | "CARD"
export type PaymentPurpose = "DUES" | "VERIFICATION" | "TREASURY_DEPOSIT"
export type PaymentStatus  = "PENDING" | "COMPLETED" | "FAILED"

export interface PaymentRecord {
  id:          string
  txRef:       string
  method:      PaymentMethod
  purpose:     PaymentPurpose
  purposeMeta: Record<string, unknown> | null
  amount:      string
  currency:    string
  status:      PaymentStatus
  createdAt:   string
  completedAt: string | null
}

export const paymentApi = {
  /** POST /payments/initiate — creates a PaymentRecord and triggers STK push or returns card link */
  initiate: (data: {
    method:      PaymentMethod
    purpose:     PaymentPurpose
    purposeMeta?: Record<string, unknown>
  }) =>
    apiFetch<{ txRef: string; paymentLink?: string }>("/payments/initiate", {
      method: "POST",
      body:   JSON.stringify(data),
    }),

  /** GET /payments/status/:txRef — poll until COMPLETED or FAILED */
  getStatus: (txRef: string) =>
    apiFetch<PaymentRecord>(`/payments/status/${txRef}`),
}

export const auditApi = {
  search: (params?: { page?: number; limit?: number; userId?: string; action?: string; fromDate?: string; toDate?: string }) =>
    apiFetch<{ logs: AuditLogDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/audit/search${buildQs(params)}`),
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export interface FeedItemDto {
  id: string
  category: "governance" | "community" | "project" | "emergency" | "marketplace" | "education"
  description: string
  timestamp: string
  entityId?: string
  meta: Record<string, unknown>
}

export interface FeedPageDto {
  items: FeedItemDto[]
  nextCursor: string | null
}

export const feedApi = {
  getFeed: (cursor?: string): Promise<FeedPageDto> =>
    apiFetch<FeedPageDto>(`/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
}

// ─────────────────────────────────────────────────────────
// Elections API  — /api/v1/elections
// ─────────────────────────────────────────────────────────

export type ElectionStatus = "PENDING" | "NOMINATIONS_OPEN" | "VOTING_OPEN" | "CLOSED"
export type ElectionScope = "GROUP" | "SYSTEM"

export interface ElectionCandidateDto {
  id: string
  userId: string
  userName: string
  avatarUrl?: string
  statement?: string
  totalWeight: number
  voteCount: number
  withdrawnAt?: string
}

export interface ElectionSummaryDto {
  id: string
  roleKey: string
  scope: ElectionScope
  groupId?: string
  groupName?: string
  countyId?: string
  status: ElectionStatus
  nominationsOpenAt: string
  nominationsCloseAt: string
  votingOpenAt: string
  votingCloseAt: string
  candidateCount: number
  totalVoteWeight: number
  quorumReached: boolean
  winnerId?: string
  winnerName?: string
  myVotedCandidateId?: string
  myNominationId?: string
}

export interface ElectionDetailDto extends ElectionSummaryDto {
  candidates: ElectionCandidateDto[]
}

export const electionsApi = {
  listElections: async (params?: {
    groupId?: string
    countyId?: string
    scope?: ElectionScope
    status?: ElectionStatus
    page?: number
    limit?: number
  }): Promise<{ elections: ElectionSummaryDto[]; total: number }> => {
    const res = await apiFetch<{ total: number; items: ElectionSummaryDto[] }>(`/elections${buildQs(params)}`)
    return { elections: res.items ?? [], total: res.total ?? 0 }
  },

  getMyElections: async (): Promise<{ elections: ElectionSummaryDto[] }> => {
    const res = await apiFetch<{ items: ElectionSummaryDto[] }>("/elections/mine")
    return { elections: res.items ?? [] }
  },

  getElection: (electionId: string): Promise<ElectionDetailDto> =>
    apiFetch<ElectionDetailDto>(`/elections/${electionId}`),

  nominate: (electionId: string, statement?: string) =>
    apiFetch<{ id: string; userId: string; electionId: string }>(`/elections/${electionId}/nominate`, {
      method: "POST",
      body: JSON.stringify({ statement }),
    }),

  withdrawNomination: (electionId: string) =>
    apiFetch<{ withdrawnAt: string }>(`/elections/${electionId}/nomination`, {
      method: "DELETE",
    }),

  castVote: (electionId: string, candidateId: string) =>
    apiFetch<{ id: string; electionId: string; candidateId: string }>(`/elections/${electionId}/vote`, {
      method: "POST",
      body: JSON.stringify({ candidateId }),
    }),
}

// ─────────────────────────────────────────────────────────
// UT Withdrawal API  — /api/v1/economy/ut
// ─────────────────────────────────────────────────────────

export interface UtWithdrawalDto {
  id: string
  amountKes: number
  mpesaPhone: string
  status: "PENDING" | "COMPLETED" | "FAILED"
  completedAt: string | null
  failureNote: string | null
  createdAt: string
}

export const utWithdrawalApi = {
  withdraw: (dto: { amountKes: number; mpesaPhone: string }) =>
    apiFetch<{ id: string; status: string }>("/economy/ut/withdraw", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  getWithdrawals: (): Promise<{
    withdrawals: UtWithdrawalDto[]
    balances: { fiatBackedUtBalance: number; earnedUtBalance: number; utilityTokens: number }
  }> =>
    apiFetch("/economy/ut/withdrawals"),
}

// ─────────────────────────────────────────────────────────
// Leaderboard (extends reputationApi)
// ─────────────────────────────────────────────────────────

export interface LeaderboardEntryDto {
  rank: number
  userId: string
  name: string
  avatarUrl?: string
  participationRights: number
  globalImpactPoints: number
  combinedScore: number
  ward: { id: string; name: string } | null
  county: { id: string; name: string } | null
}

export const leaderboardApi = {
  getLeaderboard: (params?: {
    metric?: "pr" | "ip" | "combined"
    scope?: "global" | "county" | "ward"
    scopeId?: string
    page?: number
    limit?: number
  }): Promise<{
    entries: LeaderboardEntryDto[]
    total: number
    page: number
    limit: number
    metric: string
    scope: string
  }> => apiFetch(`/reputation/leaderboard${buildQs(params)}`),
}

// ─────────────────────────────────────────────────────────
// Conflicts API  — /api/v1/conflicts
// ─────────────────────────────────────────────────────────

export interface ConflictCaseDto {
  id: string
  status: "OPEN" | "INVESTIGATING" | "MEDIATION" | "CLOSED"
  description: string
  evidence: string[]
  resolution: string | null
  resolvedAt: string | null
  createdAt: string
  complainant: { id: string; name: string }
  respondent:  { id: string; name: string }
}

// ── Platform Config ─────────────────────────────────────────────────────────

export interface PlatformConfigDto {
  key: string
  value: string
  label: string
  category: string
  updatedAt: string
}

export const platformConfigApi = {
  getAll: (): Promise<PlatformConfigDto[]> =>
    apiFetch<PlatformConfigDto[]>("/platform-config"),

  update: (key: string, value: string): Promise<PlatformConfigDto> =>
    apiFetch<PlatformConfigDto>(`/admin/platform-config/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
}

export const conflictApi = {
  fileConflict: (dto: {
    respondentId: string
    description: string
    evidence?: string[]
  }) =>
    apiFetch<ConflictCaseDto>("/conflicts", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  getMyCases: (): Promise<ConflictCaseDto[]> =>
    apiFetch<ConflictCaseDto[]>("/conflicts/my-cases"),

  getCase: (caseId: string): Promise<ConflictCaseDto> =>
    apiFetch<ConflictCaseDto>(`/conflicts/${caseId}`),

  resolveCase: (caseId: string, resolution: string): Promise<ConflictCaseDto> =>
    apiFetch<ConflictCaseDto>(`/conflicts/${caseId}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolution }),
    }),
}
