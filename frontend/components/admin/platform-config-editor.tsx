"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { platformConfigApi, type PlatformConfigDto } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings2, Check, Pencil, X } from "lucide-react"

// Inline editor for a single config row
function ConfigRow({ entry, onSave }: { entry: PlatformConfigDto; onSave: (key: string, value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.value)

  function save() {
    if (draft.trim() && draft.trim() !== entry.value) {
      onSave(entry.key, draft.trim())
    }
    setEditing(false)
  }

  function cancel() {
    setDraft(entry.value)
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(14,11,8,0.05)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#0A1F14]">{entry.label}</p>
        <p className="text-[10px] text-[#7A6E60] mt-0.5 font-mono">{entry.key}</p>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 w-28 text-xs text-right tabular-nums"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel() }}
          />
          <button onClick={save} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-[rgba(29,71,49,0.10)]">
            <Check className="h-3.5 w-3.5" style={{ color: "#1D4731" }} />
          </button>
          <button onClick={cancel} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-[rgba(176,58,30,0.10)]">
            <X className="h-3.5 w-3.5" style={{ color: "#B03A1E" }} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#0A1F14] tabular-nums">{parseInt(entry.value).toLocaleString()}</span>
          <button onClick={() => setEditing(true)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-[rgba(14,11,8,0.06)]">
            <Pencil className="h-3 w-3 text-[#7A6E60]" />
          </button>
        </div>
      )}
    </div>
  )
}

export function PlatformConfigEditor() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: entries, isLoading } = useQuery({
    queryKey: ["platform-config"],
    queryFn: platformConfigApi.getAll,
    staleTime: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      platformConfigApi.update(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-config"] })
      toast({ title: "Config updated", description: "Platform configuration saved." })
    },
    onError: (err: any) => toast({
      title: "Update failed",
      description: err?.message ?? "Please try again.",
      variant: "destructive",
    }),
  })

  const costEntries = entries?.filter((e) => e.category === "cost") ?? []
  const tierEntries = entries?.filter((e) => e.category === "tier") ?? []

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4" style={{ color: "#C9922A" }} />
          Platform Cost Configuration
        </CardTitle>
        <p className="text-xs text-[#7A6E60]">
          Changes here are reflected live on the Governance page. Values are in KES.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0A1F14]/40 mb-1">Monthly costs</p>
              {costEntries.map((e) => (
                <ConfigRow key={e.key} entry={e} onSave={(key, value) => updateMutation.mutate({ key, value })} />
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0A1F14]/40 mb-1">Contribution tiers</p>
              {tierEntries.map((e) => (
                <ConfigRow key={e.key} entry={e} onSave={(key, value) => updateMutation.mutate({ key, value })} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
