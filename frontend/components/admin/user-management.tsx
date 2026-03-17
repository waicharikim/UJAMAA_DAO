"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Search, Shield, Ban, UserCheck, Mail, MapPin, Calendar, Award, Coins, Users, X, Plus } from "lucide-react"
import { adminApi, type AdminUserDto } from "@/lib/api"

const AVAILABLE_ROLES = [
  "system:super_admin",
  "system:compliance_officer",
  "system:blockchain_admin",
  "system:contract_deployer",
  "system:multisig_signer",
  "location:ward_admin",
  "location:constituency_admin",
  "location:county_admin",
]

export function UserManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [verificationFilter, setVerificationFilter] = useState("all")
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const [showRolesDialog, setShowRolesDialog] = useState(false)
  const [rolesUser, setRolesUser] = useState<AdminUserDto | null>(null)
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState("")

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(searchInput), 500)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", debouncedSearch, statusFilter, verificationFilter],
    queryFn: () => adminApi.getUsers({
      search: debouncedSearch || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      verificationLevel: verificationFilter !== "all" ? verificationFilter : undefined,
      limit: 50,
    }),
    staleTime: 30_000,
  })

  const suspendMutation = useMutation({
    mutationFn: ({ userId, suspend, reason }: { userId: string; suspend: boolean; reason: string }) =>
      adminApi.suspendUser(userId, { suspend, reason }),
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] })
      toast({ title: suspend ? "User suspended" : "User activated", description: "User status updated." })
      setShowUserDialog(false)
      setSelectedUser(null)
    },
    onError: () => toast({ title: "Action failed", description: "Could not update user status.", variant: "destructive" }),
  })

  const [selectedUser, setSelectedUser] = useState<AdminUserDto | null>(null)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [actionType, setActionType] = useState<"suspend" | null>(null)
  const [reason, setReason] = useState("")

  const { data: userRolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin", "user-roles", rolesUser?.id],
    queryFn: () => adminApi.getUserRoles(rolesUser!.id),
    enabled: !!rolesUser && showRolesDialog,
  })

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.assignRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user-roles", rolesUser?.id] })
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setSelectedRoleToAdd("")
      toast({ title: "Role assigned", description: "Role has been assigned successfully." })
    },
    onError: () => toast({ title: "Failed", description: "Could not assign role.", variant: "destructive" }),
  })

  const revokeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.revokeRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user-roles", rolesUser?.id] })
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      toast({ title: "Role removed", description: "Role has been removed." })
    },
    onError: () => toast({ title: "Failed", description: "Could not remove role.", variant: "destructive" }),
  })

  const mapStatus = (s: string): "active" | "suspended" | "pending" =>
    s === "ACTIVE" ? "active" : s === "SUSPENDED" ? "suspended" : "pending"

  const mapVerification = (v: string): "unverified" | "email" | "phone" | "full" => {
    if (v === "COMMUNITY_VERIFIED" || v === "FULL_VERIFIED") return "full"
    if (v === "PHONE_VERIFIED") return "phone"
    if (v === "EMAIL_VERIFIED") return "email"
    return "unverified"
  }

  const getStatusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-800"
    if (status === "suspended") return "bg-red-100 text-red-800"
    return "bg-yellow-100 text-yellow-800"
  }

  const getVerificationColor = (level: string) => {
    if (level === "full") return "bg-green-100 text-green-800"
    if (level === "phone") return "bg-blue-100 text-blue-800"
    if (level === "email") return "bg-yellow-100 text-yellow-800"
    return "bg-gray-100 text-gray-800"
  }

  const users = data?.users ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger><SelectValue placeholder="Verification" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="UNVERIFIED">Unverified</SelectItem>
                <SelectItem value="EMAIL_VERIFIED">Email verified</SelectItem>
                <SelectItem value="PHONE_VERIFIED">Phone verified</SelectItem>
                <SelectItem value="COMMUNITY_VERIFIED">Community verified</SelectItem>
                <SelectItem value="FULL_VERIFIED">Fully verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({isLoading ? "…" : (data?.total ?? 0)})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => {
                const status = mapStatus(user.status)
                const verification = mapVerification(user.verificationLevel)
                return (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>{user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name ?? user.email ?? user.id.slice(0, 8)}</span>
                          <Badge className={getStatusColor(status)}>{status}</Badge>
                          <Badge className={getVerificationColor(verification)}>{verification}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          {user.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</div>}
                          {user.county && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{user.county}{user.constituency ? `, ${user.constituency}` : ""}</div>}
                          <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {formatDate(user.createdAt)}</div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1"><Award className="h-3 w-3 text-orange-500" /><span>{user.globalImpactPoints} IP</span></div>
                          <div className="flex items-center gap-1"><Coins className="h-3 w-3 text-yellow-500" /><span>{user.participationRights} PR</span></div>
                          <div className="flex gap-1">
                            {user.roles.map((role) => (
                              <Badge key={role} variant="outline" className="text-xs">{role.replace("system:", "").replace(/_/g, " ")}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setRolesUser(user); setSelectedRoleToAdd(""); setShowRolesDialog(true) }}
                      >
                        <Shield className="h-4 w-4 mr-1" />Roles
                      </Button>
                      <Button
                        size="sm"
                        variant={status === "suspended" ? "default" : "destructive"}
                        onClick={() => { setSelectedUser(user); setActionType("suspend"); setReason(""); setShowUserDialog(true) }}
                      >
                        {status === "suspended" ? <><UserCheck className="h-4 w-4 mr-1" />Activate</> : <><Ban className="h-4 w-4 mr-1" />Suspend</>}
                      </Button>
                    </div>
                  </div>
                )
              })}
              {users.length === 0 && <p className="text-center py-8 text-slate-500">No users found.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser && mapStatus(selectedUser.status) === "suspended" ? "Activate User" : "Suspend User"}</DialogTitle>
            <DialogDescription>
              {selectedUser && mapStatus(selectedUser.status) === "suspended"
                ? "Reactivate this user account?"
                : "Suspend this user? They will lose access to the platform."}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <span className="font-medium">{selectedUser.name ?? selectedUser.email}</span>
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea id="reason" placeholder="Enter reason..." className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
                <Button
                  variant={mapStatus(selectedUser.status) !== "suspended" ? "destructive" : "default"}
                  disabled={suspendMutation.isPending}
                  onClick={() => suspendMutation.mutate({ userId: selectedUser.id, suspend: mapStatus(selectedUser.status) !== "suspended", reason })}
                >
                  {suspendMutation.isPending ? "Saving…" : (mapStatus(selectedUser.status) === "suspended" ? "Activate" : "Suspend")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Manage Roles — {rolesUser?.name ?? rolesUser?.email}
            </DialogTitle>
            <DialogDescription>Add or remove system roles for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Current Roles</Label>
              {rolesLoading ? (
                <div className="h-6 w-24 animate-pulse bg-slate-200 rounded mt-2" />
              ) : (
                <div className="flex flex-wrap gap-2 mt-2 min-h-[2rem]">
                  {(userRolesData ?? []).length === 0 && (
                    <span className="text-sm text-slate-500">No roles assigned</span>
                  )}
                  {(userRolesData ?? []).map((r) => (
                    <Badge key={r.role} variant="secondary" className="flex items-center gap-1 pr-1">
                      {r.role.replace("system:", "").replace("location:", "").replace(/_/g, " ")}
                      <button
                        className="ml-1 hover:text-red-600"
                        disabled={revokeRoleMutation.isPending}
                        onClick={() => rolesUser && revokeRoleMutation.mutate({ userId: rolesUser.id, role: r.role })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium">Add Role</Label>
              <div className="flex gap-2 mt-2">
                <Select value={selectedRoleToAdd} onValueChange={setSelectedRoleToAdd}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{r.replace("system:", "").replace("location:", "").replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedRoleToAdd || assignRoleMutation.isPending}
                  onClick={() => rolesUser && assignRoleMutation.mutate({ userId: rolesUser.id, role: selectedRoleToAdd })}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setShowRolesDialog(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
