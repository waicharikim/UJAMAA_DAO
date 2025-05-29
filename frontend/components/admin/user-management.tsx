"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatAddress, formatDate } from "@/lib/utils"
import { Search, Shield, Ban, UserCheck, Mail, MapPin, Calendar, Award, Coins, Users } from "lucide-react"

interface User {
  id: string
  walletAddress: string
  username?: string
  email?: string
  county: string
  constituency: string
  roles: string[]
  status: "active" | "suspended" | "pending"
  impactPoints: number
  tokenBalance: number
  joinedAt: string
  lastActive: string
  verificationLevel: "unverified" | "email" | "phone" | "full"
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      walletAddress: "0x1234567890123456789012345678901234567890",
      username: "john_doe",
      email: "john.doe@example.com",
      county: "Nairobi",
      constituency: "Westlands",
      roles: ["user", "county_member"],
      status: "active",
      impactPoints: 1250,
      tokenBalance: 500,
      joinedAt: "2024-01-15T10:30:00Z",
      lastActive: "2024-01-20T14:22:00Z",
      verificationLevel: "full",
    },
    {
      id: "2",
      walletAddress: "0x9876543210987654321098765432109876543210",
      username: "sarah_wilson",
      email: "sarah.wilson@example.com",
      county: "Kisumu",
      constituency: "Kisumu Central",
      roles: ["user", "group_admin"],
      status: "active",
      impactPoints: 890,
      tokenBalance: 320,
      joinedAt: "2024-01-10T09:15:00Z",
      lastActive: "2024-01-20T16:45:00Z",
      verificationLevel: "email",
    },
    {
      id: "3",
      walletAddress: "0x5555666677778888999900001111222233334444",
      username: "mike_johnson",
      email: "mike.johnson@example.com",
      county: "Mombasa",
      constituency: "Mvita",
      roles: ["user"],
      status: "pending",
      impactPoints: 45,
      tokenBalance: 50,
      joinedAt: "2024-01-19T11:20:00Z",
      lastActive: "2024-01-19T11:20:00Z",
      verificationLevel: "unverified",
    },
  ])

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    role: "all",
    county: "all",
  })

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [actionType, setActionType] = useState<"edit" | "suspend" | "promote" | null>(null)

  const filteredUsers = users.filter((user) => {
    if (
      filters.search &&
      !user.username?.toLowerCase().includes(filters.search.toLowerCase()) &&
      !user.email?.toLowerCase().includes(filters.search.toLowerCase()) &&
      !user.walletAddress.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false
    }
    if (filters.status !== "all" && user.status !== filters.status) return false
    if (filters.role !== "all" && !user.roles.includes(filters.role)) return false
    if (filters.county !== "all" && user.county !== filters.county) return false
    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "suspended":
        return "bg-red-100 text-red-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getVerificationColor = (level: string) => {
    switch (level) {
      case "full":
        return "bg-green-100 text-green-800"
      case "phone":
        return "bg-blue-100 text-blue-800"
      case "email":
        return "bg-yellow-100 text-yellow-800"
      case "unverified":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleUserAction = (user: User, action: "edit" | "suspend" | "promote") => {
    setSelectedUser(user)
    setActionType(action)
    setShowUserDialog(true)
  }

  const executeUserAction = () => {
    if (!selectedUser || !actionType) return

    // Mock action execution
    console.log(`Executing ${actionType} for user:`, selectedUser.id)

    // Update user in state based on action
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id === selectedUser.id) {
          switch (actionType) {
            case "suspend":
              return { ...user, status: user.status === "suspended" ? "active" : ("suspended" as const) }
            case "promote":
              return { ...user, roles: [...user.roles, "admin"] }
            default:
              return user
          }
        }
        return user
      }),
    )

    setShowUserDialog(false)
    setSelectedUser(null)
    setActionType(null)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.role} onValueChange={(value) => setFilters((prev) => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="county_member">County Member</SelectItem>
                <SelectItem value="group_admin">Group Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.county}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, county: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="County" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counties</SelectItem>
                <SelectItem value="Nairobi">Nairobi</SelectItem>
                <SelectItem value="Kisumu">Kisumu</SelectItem>
                <SelectItem value="Mombasa">Mombasa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={`/placeholder.svg`} />
                    <AvatarFallback>
                      {user.username?.[0]?.toUpperCase() || formatAddress(user.walletAddress)[0]}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.username || formatAddress(user.walletAddress)}</span>
                      <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                      <Badge className={getVerificationColor(user.verificationLevel)}>{user.verificationLevel}</Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {user.county}, {user.constituency}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {formatDate(user.joinedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Award className="h-3 w-3 text-orange-500" />
                        <span>{user.impactPoints} points</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Coins className="h-3 w-3 text-yellow-500" />
                        <span>{user.tokenBalance} tokens</span>
                      </div>
                      <div className="flex gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleUserAction(user, "edit")}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleUserAction(user, "promote")}>
                    <Shield className="h-4 w-4 mr-1" />
                    Promote
                  </Button>
                  <Button
                    size="sm"
                    variant={user.status === "suspended" ? "default" : "destructive"}
                    onClick={() => handleUserAction(user, "suspend")}
                  >
                    {user.status === "suspended" ? (
                      <>
                        <UserCheck className="h-4 w-4 mr-1" />
                        Activate
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4 mr-1" />
                        Suspend
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Action Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "edit" && "Edit User"}
              {actionType === "suspend" && (selectedUser?.status === "suspended" ? "Activate User" : "Suspend User")}
              {actionType === "promote" && "Promote User"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "edit" && "Update user information and settings."}
              {actionType === "suspend" &&
                (selectedUser?.status === "suspended"
                  ? "Reactivate this user account?"
                  : "Suspend this user account? They will lose access to the platform.")}
              {actionType === "promote" && "Grant additional roles and permissions to this user."}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Avatar>
                  <AvatarFallback>
                    {selectedUser.username?.[0]?.toUpperCase() || formatAddress(selectedUser.walletAddress)[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {selectedUser.username || formatAddress(selectedUser.walletAddress)}
                  </div>
                  <div className="text-sm text-slate-600">{selectedUser.email}</div>
                </div>
              </div>

              {actionType === "suspend" && (
                <div>
                  <Label htmlFor="reason">
                    Reason for {selectedUser.status === "suspended" ? "activation" : "suspension"}
                  </Label>
                  <Textarea id="reason" placeholder="Enter reason..." className="mt-1" />
                </div>
              )}

              {actionType === "promote" && (
                <div>
                  <Label>Select additional roles:</Label>
                  <div className="space-y-2 mt-2">
                    {["admin", "county_admin", "super_admin"].map((role) => (
                      <label key={role} className="flex items-center gap-2">
                        <input type="checkbox" disabled={selectedUser.roles.includes(role)} className="rounded" />
                        <span className="capitalize">{role.replace("_", " ")}</span>
                        {selectedUser.roles.includes(role) && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowUserDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={executeUserAction}
                  variant={actionType === "suspend" && selectedUser.status !== "suspended" ? "destructive" : "default"}
                >
                  {actionType === "edit" && "Save Changes"}
                  {actionType === "suspend" && (selectedUser.status === "suspended" ? "Activate" : "Suspend")}
                  {actionType === "promote" && "Promote User"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
