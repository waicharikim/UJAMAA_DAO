const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"

const mockProposals = [
  {
    id: "1",
    title: "Community Solar Energy Initiative",
    description:
      "Establish solar panels in community centers to reduce energy costs and promote renewable energy adoption across Westlands constituency.",
    purpose: "nonprofit" as const,
    locationScope: "constituency" as const,
    isPrivate: false,
    createdBy: {
      id: "2",
      name: "Green Energy Collective",
      avatar: "/placeholder.svg",
    },
    groupId: "1",
    groupName: "Green Energy Collective",
    tokenCost: 10,
    impactPointsRequired: 100,
    status: "active" as const,
    votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    votingStats: {
      totalVotes: 60,
      yesVotes: 45,
      noVotes: 12,
      abstainVotes: 3,
      quorumRequired: 75,
      consensusRequired: 68,
      currentQuorum: 78,
      currentConsensus: 75,
    },
    canVote: true,
    canEdit: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Digital Literacy Training Program",
    description:
      "Implement comprehensive digital literacy training for rural communities to bridge the digital divide and enhance economic opportunities.",
    purpose: "nonprofit" as const,
    locationScope: "county" as const,
    isPrivate: false,
    createdBy: {
      id: "1",
      name: "Demo User",
      avatar: "/placeholder.svg",
    },
    tokenCost: 15,
    impactPointsRequired: 150,
    status: "active" as const,
    votingDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    votingStats: {
      totalVotes: 33,
      yesVotes: 23,
      noVotes: 8,
      abstainVotes: 2,
      quorumRequired: 75,
      consensusRequired: 68,
      currentQuorum: 65,
      currentConsensus: 70,
    },
    canVote: true,
    canEdit: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Local Business Support Fund",
    description: "Create a fund to support local small businesses with micro-loans and business development resources.",
    purpose: "business" as const,
    locationScope: "local" as const,
    isPrivate: false,
    createdBy: {
      id: "3",
      name: "Business Alliance",
      avatar: "/placeholder.svg",
    },
    groupId: "2",
    groupName: "Business Alliance",
    tokenCost: 20,
    impactPointsRequired: 200,
    status: "active" as const,
    votingDeadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    votingStats: {
      totalVotes: 18,
      yesVotes: 15,
      noVotes: 2,
      abstainVotes: 1,
      quorumRequired: 75,
      consensusRequired: 68,
      currentQuorum: 45,
      currentConsensus: 83,
    },
    canVote: true,
    canEdit: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// Mock user votes storage
const mockUserVotes: any[] = []

class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  setToken(token: string | null) {
    this.token = token
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Mock API responses for demonstration
    await this.delay(500) // Simulate network delay

    // Mock responses based on endpoint
    if (endpoint === "/auth/nonce") {
      return { nonce: "demo-nonce-123" } as T
    }

    if (endpoint === "/auth/verify") {
      return {
        token: "demo-jwt-token-123",
        user: {
          id: "1",
          walletAddress: "0x1234567890123456789012345678901234567890",
          username: "Demo User",
          email: "demo@example.com",
        },
      } as T
    }

    if (endpoint === "/users/me") {
      return {
        id: "1",
        walletAddress: "0x1234567890123456789012345678901234567890",
        username: "Demo User",
        email: "demo@example.com",
        avatar: "/placeholder.svg",
        bio: "This is a demo user profile",
        privacySettings: {
          profileVisibility: "public",
          emailVisibility: "private",
          walletVisibility: "public",
        },
        roles: [
          {
            id: "1",
            name: "User",
            scopes: ["profile:read", "profile:write", "groups:read"],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as T
    }

    if (endpoint === "/groups") {
      return [
        {
          id: "1",
          name: "Web3 Developers",
          description: "A community for Web3 developers to share knowledge and collaborate",
          avatar: "/placeholder.svg",
          memberCount: 42,
          userRole: "Member",
          isPrivate: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          name: "DeFi Enthusiasts",
          description: "Discussing the latest in decentralized finance",
          avatar: "/placeholder.svg",
          memberCount: 128,
          userRole: "Admin",
          isPrivate: true,
          createdAt: new Date().toISOString(),
        },
      ] as T
    }

    if (endpoint.startsWith("/groups/") && endpoint.endsWith("/members")) {
      return [
        {
          id: "1",
          user: {
            id: "1",
            walletAddress: "0x1234567890123456789012345678901234567890",
            username: "Demo User",
            avatar: "/placeholder.svg",
          },
          role: "Admin",
          joinedAt: new Date().toISOString(),
        },
        {
          id: "2",
          user: {
            id: "2",
            walletAddress: "0x9876543210987654321098765432109876543210",
            username: "Alice",
            avatar: "/placeholder.svg",
          },
          role: "Member",
          joinedAt: new Date().toISOString(),
        },
      ] as T
    }

    if (endpoint === "/notifications") {
      return [
        {
          id: "1",
          type: "info",
          title: "Welcome to the platform!",
          message: "Thanks for joining our Web3 community",
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          type: "success",
          title: "Profile updated",
          message: "Your profile has been successfully updated",
          read: true,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ] as T
    }

    if (endpoint === "/notifications/preferences") {
      return {
        email: true,
        sms: false,
        inApp: true,
        groupInvites: true,
        roleChanges: true,
        systemUpdates: false,
      } as T
    }

    // Proposals endpoint - Return the array directly
    if (endpoint === "/proposals" || endpoint.startsWith("/proposals")) {
      return mockProposals as T
    }

    // User votes endpoint
    if (endpoint === "/votes/user") {
      return mockUserVotes as T
    }

    // Default mock response
    return {} as T
  }

  // Auth endpoints
  async getNonce(walletAddress: string): Promise<{ nonce: string }> {
    return this.request("/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    })
  }

  async verifySignature(walletAddress: string, signature: string): Promise<{ token: string; user: any }> {
    return this.request("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ walletAddress, signature }),
    })
  }

  // User endpoints
  async getMe(): Promise<any> {
    return this.request("/users/me")
  }

  async updateProfile(data: Partial<any>): Promise<any> {
    return this.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async updatePrivacySettings(settings: any): Promise<any> {
    return this.request("/users/me/privacy", {
      method: "PATCH",
      body: JSON.stringify(settings),
    })
  }

  // Groups endpoints
  async getGroups(): Promise<any[]> {
    return this.request("/groups")
  }

  async getGroup(id: string): Promise<any> {
    const groups = await this.getGroups()
    return groups.find((g) => g.id === id) || groups[0]
  }

  async getGroupMembers(id: string): Promise<any[]> {
    return this.request(`/groups/${id}/members`)
  }

  // Notifications endpoints
  async getNotifications(): Promise<any[]> {
    return this.request("/notifications")
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/notifications/${id}/read`, { method: "PATCH" })
  }

  async getNotificationPreferences(): Promise<any> {
    return this.request("/notifications/preferences")
  }

  async updateNotificationPreferences(preferences: any): Promise<any> {
    return this.request("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(preferences),
    })
  }

  // Proposals endpoints
  async getProposals(filters?: any): Promise<any[]> {
    await this.delay(800)
    return this.request("/proposals")
  }

  async getUserGroups(): Promise<any[]> {
    return [
      {
        id: "1",
        name: "Green Energy Group",
        description: "Focused on renewable energy initiatives",
      },
      {
        id: "2",
        name: "Education Alliance",
        description: "Improving educational opportunities",
      },
    ]
  }

  async createProposal(data: any): Promise<any> {
    await this.delay(1000) // Simulate API delay
    return {
      id: Date.now().toString(),
      ...data,
      status: "draft",
      createdBy: {
        id: "1",
        name: "Demo User",
      },
      votingStats: {
        totalVotes: 0,
        yesVotes: 0,
        noVotes: 0,
        abstainVotes: 0,
        quorumRequired: 75,
        consensusRequired: 68,
        currentQuorum: 0,
        currentConsensus: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  async voteOnProposal(proposalId: string, vote: string): Promise<void> {
    await this.delay(500) // Simulate API delay

    // Add vote to mock storage
    const voteRecord = {
      proposalId,
      userId: "1", // Current user ID
      vote,
      tokensCost: mockProposals.find((p) => p.id === proposalId)?.tokenCost || 0,
      timestamp: new Date().toISOString(),
    }

    mockUserVotes.push(voteRecord)

    // Update proposal vote counts in mock data
    const proposalIndex = mockProposals.findIndex((p) => p.id === proposalId)
    if (proposalIndex !== -1) {
      const proposal = mockProposals[proposalIndex]
      proposal.votingStats.totalVotes += 1

      if (vote === "yes") {
        proposal.votingStats.yesVotes += 1
      } else if (vote === "no") {
        proposal.votingStats.noVotes += 1
      } else {
        proposal.votingStats.abstainVotes += 1
      }

      // Recalculate percentages
      const totalVotes = proposal.votingStats.totalVotes
      proposal.votingStats.currentConsensus = totalVotes > 0 ? (proposal.votingStats.yesVotes / totalVotes) * 100 : 0
      proposal.votingStats.currentQuorum = Math.min((totalVotes / 100) * 100, 100) // Assuming 100 eligible voters
    }
  }

  async getUserVotes(): Promise<any[]> {
    await this.delay(300)
    return mockUserVotes
  }
}

// Create and export the API client instance
export const apiClient = new ApiClient(API_BASE_URL)
