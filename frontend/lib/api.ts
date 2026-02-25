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
    throw new ApiError(res.status, message)
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
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
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
  }) =>
    apiFetch<void>("/auth/magic-link/send", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * GET /auth/login?token=...
   * Exchanges the magic link token for access + refresh tokens.
   * Returns { accessToken, refreshToken, user } where user = AuthUserResponse shape:
   *   { id, email, name, phoneNumber, walletAddress, verificationLevel,
   *     primaryWardId, secondaryWardId, emailVerified, phoneVerified,
   *     communityVerified, globalImpactPoints, utilityTokens,
   *     participationRights, roles: string[], createdAt, lastLoginAt }
   */
  verifyMagicLink: (token: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: any }>(
      `/auth/login?token=${encodeURIComponent(token)}`
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
   * Requires: COMMUNITY_VERIFIED
   */
  sendPhoneCode: (phoneNumber: string) =>
    apiFetch<void>("/auth/phone/send-code", {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    }),

  /**
   * POST /auth/phone/verify-code
   * Verify the SMS code.
   * Requires: COMMUNITY_VERIFIED
   */
  verifyPhoneCode: (code: string) =>
    apiFetch<void>("/auth/phone/verify-code", {
      method: "POST",
      body: JSON.stringify({ code }),
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
    apiFetch<void>("/users/verify-community/request", { method: "POST" }),

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
      status: string
      vouchCount: number
      requiredVouches: number
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

  async getNotifications(): Promise<any[]> {
    return []
  }

  async getNotificationPreferences(): Promise<any> {
    return {}
  }

  async updateNotificationPreferences(_preferences: any): Promise<any> {
    return {}
  }

  async getGroups(): Promise<any[]> {
    return []
  }

  async getGroup(_id: string): Promise<any> {
    return null
  }

  async getGroupMembers(_id: string): Promise<any[]> {
    return []
  }

  async getProposals(_filters?: any): Promise<any[]> {
    return []
  }

  async getUserGroups(): Promise<any[]> {
    return []
  }

  async createProposal(_data: any): Promise<any> {
    return null
  }

  async voteOnProposal(_proposalId: string, _vote: string): Promise<void> {}

  async getUserVotes(): Promise<any[]> {
    return []
  }
}

export const apiClient = new ApiClient()
