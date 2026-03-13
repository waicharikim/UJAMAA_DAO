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

export const integrationApi = {
  getBarazaGroups: () =>
    apiFetch<BarazaGroupDto[]>("/integration/baraza-groups"),

  registerBarazaGroup: (dto: RegisterBarazaGroupDto) =>
    apiFetch<BarazaGroupDto>("/integration/baraza-groups", {
      method: "POST",
      body: JSON.stringify(dto),
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
  getNotifications: () =>
    apiFetch<NotificationDto[]>("/notifications"),

  markRead: (notificationId: string) =>
    apiFetch<void>("/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ notificationId }),
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
    apiFetch<unknown>("/community/voluntary/create", {
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
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ groups: GroupDiscoveryDto[]; total: number }> => {
    const q = new URLSearchParams()
    if (params?.isSystem !== undefined) q.set("isSystem", String(params.isSystem))
    if (params?.voluntaryType) q.set("voluntaryType", params.voluntaryType)
    if (params?.search) q.set("search", params.search)
    if (params?.limit) q.set("limit", String(params.limit))
    if (params?.offset) q.set("offset", String(params.offset))
    const qs = q.toString()
    return apiFetch<{ groups: GroupDiscoveryDto[]; total: number }>(`/community${qs ? `?${qs}` : ""}`)
  },

  getGroupDetail: (groupId: string): Promise<GroupDetailDto> =>
    apiFetch<GroupDetailDto>(`/community/${groupId}`),

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
}

// ─────────────────────────────────────────────────────────
// Governance API  — /api/v1/governance
// ─────────────────────────────────────────────────────────

export interface ProposalDto {
  id: string
  title: string
  description: string
  proposalType: string
  status: string
  groupId: string | null
  creatorId: string
  budget: string | null
  votingStartsAt: string | null
  votingEndsAt: string | null
  createdAt: string
  updatedAt: string
  creator: { id: string; name: string; avatarUrl?: string } | null
  group: { id: string; name: string; locationScope?: string } | null
  votesSummary?: { total: number; yesWeight: number; noWeight: number }
  _count?: { votes: number }
}

export const governanceApi = {
  createProposal: (dto: {
    groupId: string
    title: string
    description: string
    fundingAmountKes?: number
    isEmergency?: boolean
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
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ proposals: ProposalDto[]; total: number; limit: number; offset: number }> => {
    const q = new URLSearchParams()
    if (params?.groupId) q.set("groupId", params.groupId)
    if (params?.status) q.set("status", params.status)
    if (params?.limit) q.set("limit", String(params.limit))
    if (params?.offset) q.set("offset", String(params.offset))
    return apiFetch(`/governance${q.toString() ? `?${q}` : ""}`)
  },

  getProposal: (proposalId: string): Promise<ProposalDto> =>
    apiFetch<ProposalDto>(`/governance/${proposalId}`),
}

// ─────────────────────────────────────────────────────────
// Projects API
// ─────────────────────────────────────────────────────────

export interface ProjectMilestoneDto {
  id: string
  projectId: string
  title: string
  description: string | null
  status: "PENDING" | "IN_PROGRESS" | "AWAITING_VERIFICATION" | "VERIFIED" | "REJECTED"
  dueDate: string | null
  orderIndex: number
  proposalMilestoneId: string | null
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

export const projectApi = {
  getProjects: (params?: {
    ownerGroupId?: string
    ownerUserId?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ projects: ProjectListItemDto[]; total: number; limit: number; offset: number }> => {
    const q = new URLSearchParams()
    if (params?.ownerGroupId) q.set("ownerGroupId", params.ownerGroupId)
    if (params?.ownerUserId) q.set("ownerUserId", params.ownerUserId)
    if (params?.status) q.set("status", params.status)
    if (params?.limit) q.set("limit", String(params.limit))
    if (params?.offset) q.set("offset", String(params.offset))
    return apiFetch(`/projects${q.toString() ? `?${q}` : ""}`)
  },

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

  // Delegates to notificationsApi; maps backend isRead → frontend read field
  async getNotifications(): Promise<any[]> {
    try {
      const dtos = await notificationsApi.getNotifications()
      return dtos.map((n) => ({
        ...n,
        read: n.isRead,
        userId: "",
        category: "system",
        channels: [],
        deliveryStatus: {},
      }))
    } catch {
      return []
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    await notificationsApi.markRead(id)
  }

  async getNotificationPreferences(): Promise<any> {
    return {}
  }

  async updateNotificationPreferences(_preferences: any): Promise<any> {
    return {}
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
