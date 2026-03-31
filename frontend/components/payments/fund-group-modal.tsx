"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from "@tanstack/react-query"
import { communityApi, type GroupDiscoveryDto } from "@/lib/api"
import { PaymentModal } from "./payment-modal"
import { Loader2, Search, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type LevelTab = "national" | "county" | "constituency" | "ward" | "voluntary"

const LEVEL_TABS: { key: LevelTab; label: string; systemType?: string; isSystem: boolean }[] = [
  { key: "national",     label: "National",     systemType: "NATIONAL",     isSystem: true },
  { key: "county",       label: "County",       systemType: "COUNTY",       isSystem: true },
  { key: "constituency", label: "Constituency", systemType: "CONSTITUENCY", isSystem: true },
  { key: "ward",         label: "Ward",         systemType: "WARD",         isSystem: true },
  { key: "voluntary",    label: "Voluntary",                                isSystem: false },
]

interface Props {
  open: boolean
  onClose: () => void
  preselectedGroupId?: string
  preselectedGroupName?: string
}

export function FundGroupModal({ open, onClose, preselectedGroupId, preselectedGroupName }: Props) {
  const { toast } = useToast()
  const [level, setLevel] = useState<LevelTab>("ward")
  const [search, setSearch] = useState("")
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string } | null>(
    preselectedGroupId && preselectedGroupName
      ? { id: preselectedGroupId, name: preselectedGroupName }
      : null
  )
  const [amount, setAmount] = useState("")
  const [payOpen, setPayOpen] = useState(false)

  const currentLevel = LEVEL_TABS.find((t) => t.key === level)!

  const { data, isLoading } = useQuery({
    queryKey: ["fund-group-list", level, search],
    queryFn: () =>
      communityApi.getGroups({
        isSystem: currentLevel.isSystem,
        systemType: currentLevel.systemType,
        search: search || undefined,
        limit: 20,
      }),
    enabled: open && !preselectedGroupId,
    staleTime: 30_000,
  })

  const groups = data?.groups ?? []

  const handleProceed = () => {
    if (!selectedGroup) return
    const amt = parseFloat(amount)
    if (!amt || amt < 10) {
      toast({ variant: "destructive", title: "Enter at least KES 10" })
      return
    }
    setPayOpen(true)
  }

  const handlePaySuccess = (txRef: string) => {
    setPayOpen(false)
    onClose()
    toast({ title: "Contribution sent!", description: `Ref: ${txRef}` })
  }

  return (
    <>
      <Dialog open={open && !payOpen} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fund a Group</DialogTitle>
          </DialogHeader>

          {/* If preselected, skip group picker */}
          {preselectedGroupId && preselectedGroupName ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-sm">{preselectedGroupName}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  min={10}
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleProceed} disabled={!amount}>
                Continue to Payment
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Level selector */}
              <Tabs value={level} onValueChange={(v) => { setLevel(v as LevelTab); setSelectedGroup(null) }}>
                <TabsList className="grid grid-cols-5 w-full">
                  {LEVEL_TABS.map((t) => (
                    <TabsTrigger key={t.key} value={t.key} className="text-xs">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {LEVEL_TABS.map((t) => (
                  <TabsContent key={t.key} value={t.key} className="mt-3 space-y-2">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-8"
                        placeholder={`Search ${t.label.toLowerCase()} groups…`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    {/* Group list */}
                    <div className="max-h-44 overflow-y-auto space-y-1 rounded-md border p-1">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : groups.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">No groups found</p>
                      ) : (
                        groups.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setSelectedGroup({ id: g.id, name: g.name })}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                              selectedGroup?.id === g.id
                                ? "bg-amber-100 text-amber-900 font-medium"
                                : "hover:bg-slate-100"
                            )}
                          >
                            <div className="font-medium">{g.name}</div>
                            <div className="text-xs text-slate-500">
                              {g.memberCount} members
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Amount input — only show when group selected */}
              {selectedGroup && (
                <div className="space-y-1.5">
                  <Label>
                    Amount (KES) — contributing to{" "}
                    <span className="font-semibold">{selectedGroup.name}</span>
                  </Label>
                  <Input
                    type="number"
                    min={10}
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleProceed}
                disabled={!selectedGroup || !amount}
              >
                Continue to Payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment modal */}
      {selectedGroup && (
        <PaymentModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          purpose="TREASURY_DEPOSIT"
          purposeMeta={{ groupId: selectedGroup.id }}
          amount={parseFloat(amount) || 0}
          label={`Contribution to ${selectedGroup.name}`}
          onSuccess={handlePaySuccess}
        />
      )}
    </>
  )
}
