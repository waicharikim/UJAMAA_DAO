"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { authApi, userApi, tokenStore, ApiError } from "@/lib/api"
import type { User, AuthState } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

// ─────────────────────────────────────────────────────────
// Map backend user fields → frontend User type
//
// TWO backend shapes come through here:
//
// A) Auth login (verifyMagicLink) — toUserResponse() shape:
//    { id, email, name, phoneNumber, walletAddress, verificationLevel,
//      primaryWardId, secondaryWardId, emailVerified, phoneVerified,
//      communityVerified, globalImpactPoints, utilityTokens,
//      participationRights, roles: string[], createdAt, lastLoginAt }
//
// B) Profile fetch (getMe / updateProfile) — UserProfileResponse shape:
//    { id, email, name, phoneNumber, avatarUrl, walletAddress,
//      geographic: { primaryWard, primaryConstituency, primaryCounty, ... },
//      verification: { level, emailVerified, phoneVerified, communityVerified },
//      impact: { global, ... },
//      economic: { utilityTokens, participationRights },
//      industries: [{ id, name, isPrimary }],
//      metadata: { createdAt, lastLoginAt } }
//
// Note: backend never returns bio (not in schema), privacySettings (stripped),
// notificationPreferences (different structure), or originCounty/Constituency.
// ─────────────────────────────────────────────────────────
function mapBackendUser(raw: any): User {
  // Resolve impact points — handle both shapes
  const globalIP =
    raw.impact?.global ??        // getMe shape
    raw.globalImpactPoints ??    // auth shape
    0

  // Resolve PR balance — handle both shapes
  const prBalance =
    raw.economic?.participationRights ??  // getMe shape
    raw.participationRights ??            // auth shape
    0

  // Resolve location — getMe returns full hierarchy under geographic
  const primaryCountyName = raw.geographic?.primaryCounty?.name ?? ""
  const primaryConstituencyName = raw.geographic?.primaryConstituency?.name ?? ""

  // Resolve industries — getMe returns industries array
  const primaryIndustry =
    Array.isArray(raw.industries)
      ? (raw.industries.find((i: any) => i.isPrimary) ?? raw.industries[0])?.name ?? ""
      : ""

  // Resolve roles — auth shape returns string[]; getMe doesn't return roles at all
  const roles = Array.isArray(raw.roles)
    ? raw.roles.map((r: any) =>
        typeof r === "string"
          ? {
              id: r,
              name: r,
              description: "",
              level: "system" as const,
              scopes: [],
              requiresElection: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : {
              id: r.id ?? "",
              name: r.name ?? "User",
              description: r.description ?? "",
              level: r.level ?? "system",
              scopes: r.scopes ?? [],
              requiresElection: r.requiresElection ?? false,
              createdAt: r.createdAt ?? new Date().toISOString(),
              updatedAt: r.updatedAt ?? new Date().toISOString(),
            }
      )
    : []

  // Resolve timestamps — handle both shapes
  const createdAt = raw.createdAt ?? raw.metadata?.createdAt ?? new Date().toISOString()
  const updatedAt = raw.updatedAt ?? new Date().toISOString()

  return {
    id: raw.id,
    walletAddress: raw.walletAddress ?? "",

    // backend: name (not username)
    username: raw.name ?? undefined,

    // verificationLevel — auth shape: raw.verificationLevel, getMe: raw.verification?.level
    verificationLevel: (raw.verificationLevel ?? raw.verification?.level ?? undefined) as User["verificationLevel"],

    // backend: email (same)
    email: raw.email ?? undefined,

    // backend: phoneNumber (not phone)
    phone: raw.phoneNumber ?? undefined,

    // backend: avatarUrl (not avatar); only in getMe shape
    avatar: raw.avatarUrl ?? undefined,

    // bio is NOT in the backend schema — always undefined
    bio: undefined,

    // Location hierarchy — only available from getMe shape
    primaryWardId: raw.geographic?.primaryWard?.id ?? undefined,
    residenceCounty: primaryCountyName,
    residenceConstituency: primaryConstituencyName,
    // originCounty / originConstituency are not in backend — omit or empty
    originCounty: "",
    originConstituency: "",

    // Industries — primary industry name from getMe, empty on auth shape
    industry: primaryIndustry,
    // goodsServices not returned in getMe (separate endpoint); empty default
    goodsServices: [],

    // Impact & token balances
    impactPoints: {
      global: globalIP,
      byLocation: {},  // not returned by any endpoint; fetch separately when needed
    },
    tokenBalance: prBalance,
    utBalance:
      raw.economic?.utilityTokens ??  // getMe shape
      raw.utilityTokens ??            // auth login shape
      0,

    // projectParticipation not tracked by backend yet
    projectParticipation: {
      constituency: 0,
      county: 0,
      national: 0,
    },

    // privacySettings are stripped before sending; use defaults
    privacySettings: {
      profileVisibility: "public" as const,
      emailVisibility: "private" as const,
      phoneVisibility: "private" as const,
      walletVisibility: "public" as const,
      locationVisibility: "public" as const,
      participationVisibility: "public" as const,
      voteHistory: "anonymous" as const,
      proposalHistory: "public" as const,
      projectParticipation: "public" as const,
    },

    // notificationPreferences have different backend structure; use defaults
    notificationPreferences: {
      email: true,
      sms: true,
      inApp: true,
      push: false,
      votingReminders: true,
      proposalUpdates: true,
      projectMilestones: true,
      groupInvitations: true,
      roleChanges: true,
      adminElections: false,
      fundingUpdates: true,
      systemAnnouncements: true,
      digestFrequency: "daily" as const,
      quietHours: { enabled: false, start: "22:00", end: "08:00" },
    },

    roles,
    createdAt,
    updatedAt,
  }
}

// ─────────────────────────────────────────────────────────
// Context type
// ─────────────────────────────────────────────────────────

interface AuthContextType extends Pick<AuthState, "user" | "token" | "isAuthenticated" | "isLoading"> {
  /** Step 1 of magic link flow: sends the link email (existing users: email only; new users: full registration params) */
  requestMagicLink: (params: { email: string; name?: string; phoneNumber?: string; primaryWardId?: string; secondaryWardId?: string; industryIds?: string[]; goodsServiceIds?: string[]; messagingPlatforms?: Array<{ platform: "TELEGRAM" | "WHATSAPP" | "DISCORD"; handle?: string }> }) => Promise<void>
  /** Step 2a: called from /auth/callback for existing users (JWT magic link) */
  verifyMagicLink: (token: string) => Promise<{ needsProfileCompletion: boolean }>
  /** Step 2b: called from /auth/callback for new users (hex email verification token) */
  verifyEmailToken: (token: string) => Promise<{ needsProfileCompletion: boolean }>
  logout: () => Promise<void>
  /** Patch local user state with already-mapped Partial<User> fields */
  updateUser: (userData: Partial<User>) => void
  /** Re-fetch /users/me and remap — use after profile updates that return raw backend data */
  refreshUser: () => Promise<void>
  /** Sign in with a wallet signature. walletAddress + signature come from personal_sign. */
  login: (walletAddress: string, signature: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // ── hydrate from stored tokens on mount ──
  useEffect(() => {
    const stored = tokenStore.getAccess()
    if (!stored) {
      setIsLoading(false)
      return
    }
    setToken(stored)
    userApi
      .getMe()
      .then((raw) => {
        setUser(mapBackendUser(raw))
      })
      .catch(() => {
        // Token invalid or expired — clear and stay logged out
        tokenStore.clear()
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  // ── step 1: request magic link ──
  const requestMagicLink = useCallback(
    async (params: { email: string; name?: string; phoneNumber?: string; primaryWardId?: string; secondaryWardId?: string; industryIds?: string[]; goodsServiceIds?: string[]; messagingPlatforms?: Array<{ platform: "TELEGRAM" | "WHATSAPP" | "DISCORD"; handle?: string }> }) => {
      setIsLoading(true)
      try {
        await authApi.requestMagicLink(params)
        toast({
          title: "Magic link sent",
          description: `Check ${params.email} for your login link.`,
        })
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to send login link."
        toast({ title: "Error", description: message, variant: "destructive" })
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [toast]
  )

  // ── step 2a: verify magic link token (existing users — JWT) ──
  // Backend returns { sessionToken, user, session, needsProfileCompletion } — field is sessionToken, not accessToken
  const verifyMagicLink = useCallback(
    async (linkToken: string): Promise<{ needsProfileCompletion: boolean }> => {
      setIsLoading(true)
      try {
        const { sessionToken, user: rawUser, needsProfileCompletion } = await authApi.verifyMagicLink(linkToken)
        tokenStore.set(sessionToken)
        setToken(sessionToken)
        const mappedUser = mapBackendUser(rawUser)
        setUser(mappedUser)
        toast({ title: "Welcome back!", description: `Logged in as ${mappedUser.email || mappedUser.username}.` })
        return { needsProfileCompletion: needsProfileCompletion ?? false }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Login link is invalid or expired."
        toast({ title: "Login failed", description: message, variant: "destructive" })
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [toast]
  )

  // ── step 2b: verify email token (new users) ──
  const verifyEmailToken = useCallback(
    async (linkToken: string): Promise<{ needsProfileCompletion: boolean }> => {
      setIsLoading(true)
      try {
        const { sessionToken, user: rawUser, needsProfileCompletion } = await authApi.verifyEmailToken(linkToken)
        // sessionToken is a 7-day access JWT; no refresh token in this flow
        tokenStore.set(sessionToken)
        setToken(sessionToken)
        const mappedUser = mapBackendUser(rawUser)
        setUser(mappedUser)
        toast({ title: "Welcome to UjamaaDAO!", description: `Account verified. Karibu, ${mappedUser.username || mappedUser.email}!` })
        return { needsProfileCompletion: needsProfileCompletion ?? false }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Verification link is invalid or expired."
        toast({ title: "Verification failed", description: message, variant: "destructive" })
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [toast]
  )

  // ── logout ──
  const logout = useCallback(async () => {
    await authApi.logout()
    tokenStore.clear()
    setToken(null)
    setUser(null)
    toast({ title: "Logged out", description: "You have been signed out." })
  }, [toast])

  // ── local user update (for already-mapped fields) ──
  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null))
  }, [])

  // ── re-fetch and remap from backend (use after profile PATCH) ──
  const refreshUser = useCallback(async () => {
    try {
      const raw = await userApi.getMe()
      setUser(mapBackendUser(raw))
    } catch {
      // silently fail — user state stays as-is
    }
  }, [])

  // ── wallet login ──
  const login = useCallback(
    async (walletAddress: string, signature: string) => {
      try {
        const { sessionToken, user: rawUser } = await authApi.walletLogin(walletAddress, signature)
        tokenStore.set(sessionToken)
        setToken(sessionToken)
        setUser(mapBackendUser(rawUser))
        toast({ title: "Welcome!", description: "Signed in with wallet." })
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Wallet sign-in failed."
        toast({ title: "Sign-in failed", description: message, variant: "destructive" })
        throw err
      }
    },
    [toast]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        requestMagicLink,
        verifyMagicLink,
        verifyEmailToken,
        logout,
        updateUser,
        refreshUser,
        login,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
