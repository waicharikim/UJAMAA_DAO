"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useSignMessage } from "@/lib/wagmi"
import { apiClient } from "@/lib/api"
import type { User, AuthState } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface AuthContextType extends AuthState {
  login: (walletAddress: string) => Promise<void>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  })

  const { signMessageAsync } = useSignMessage()
  const { toast } = useToast()

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem("auth_token")
    if (token) {
      // Safely set token on API client
      if (apiClient && typeof apiClient.setToken === "function") {
        apiClient.setToken(token)
      }
      fetchUser(token)
    } else {
      setAuthState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [])

  const fetchUser = async (token: string) => {
    try {
      // Mock user data for demonstration
      const user = {
        id: "1",
        walletAddress: "0x1234567890123456789012345678901234567890",
        username: "Demo User",
        email: "demo@example.com",
        phone: "+254700000000",
        avatar: "/placeholder.svg",
        bio: "This is a demo user profile",

        // Dual location system
        residenceCounty: "Nairobi",
        residenceConstituency: "Westlands",
        originCounty: "Kisumu",
        originConstituency: "Kisumu Central",

        // Professional information
        industry: "Technology",
        goodsServices: ["Software Development", "IT Consulting"],

        // Governance metrics - properly structured
        impactPoints: {
          global: 1250,
          byLocation: {
            Nairobi: 800,
            Westlands: 600,
            Kisumu: 450,
            "Kisumu Central": 300,
          },
        },
        tokenBalance: 500,

        // Participation tracking
        projectParticipation: {
          constituency: 3,
          county: 2,
          national: 1,
        },

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

        // Notification preferences
        notificationPreferences: {
          email: true,
          sms: true,
          inApp: true,
          push: true,
          votingReminders: true,
          proposalUpdates: true,
          projectMilestones: true,
          groupInvitations: true,
          roleChanges: true,
          adminElections: true,
          fundingUpdates: true,
          systemAnnouncements: true,
          digestFrequency: "daily" as const,
          quietHours: {
            enabled: false,
            start: "22:00",
            end: "08:00",
          },
        },

        roles: [
          {
            id: "1",
            name: "User",
            scopes: ["profile:read", "profile:write", "groups:read", "proposals:read", "proposals:vote"],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      console.error("Failed to fetch user:", error)
      localStorage.removeItem("auth_token")
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  }

  const login = async (walletAddress: string) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }))

      // Mock authentication for demonstration
      const message = `Please sign this message to authenticate: demo-nonce-123`
      const signature = await signMessageAsync({ message })

      // Mock token
      const token = "demo-jwt-token-123"

      // Store token and update state
      localStorage.setItem("auth_token", token)

      // Safely set token on API client
      if (apiClient && typeof apiClient.setToken === "function") {
        apiClient.setToken(token)
      }

      await fetchUser(token)

      toast({
        title: "Welcome!",
        description: "Successfully authenticated with your wallet.",
      })
    } catch (error) {
      console.error("Login failed:", error)
      setAuthState((prev) => ({ ...prev, isLoading: false }))
      toast({
        title: "Authentication Failed",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const logout = () => {
    localStorage.removeItem("auth_token")

    // Safely clear token on API client
    if (apiClient && typeof apiClient.setToken === "function") {
      apiClient.setToken(null)
    }

    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    })
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    })
  }

  const updateUser = (userData: Partial<User>) => {
    setAuthState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...userData } : null,
    }))
  }

  return <AuthContext.Provider value={{ ...authState, login, logout, updateUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
