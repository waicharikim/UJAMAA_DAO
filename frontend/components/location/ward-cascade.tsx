"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { userApi } from "@/lib/api"

export interface RefItem {
  id: string
  name: string
}

/**
 * Cascading County → Constituency → Ward selector.
 *
 * Shared by registration and the "complete your location" prompt. The parent
 * owns the selected ids (so it can submit them); this component only loads the
 * dependent lists and renders the three selects + a confirmation chip.
 */
export function WardCascade({
  heading,
  countyId,
  constituencyId,
  wardId,
  counties,
  onCountyChange,
  onConstituencyChange,
  onWardChange,
}: {
  heading: string
  countyId: string
  constituencyId: string
  wardId: string
  counties: RefItem[]
  onCountyChange: (id: string) => void
  onConstituencyChange: (id: string) => void
  onWardChange: (id: string) => void
}) {
  const [constituencies, setConstituencies] = useState<RefItem[]>([])
  const [wards, setWards] = useState<RefItem[]>([])
  const [loadingC, setLoadingC] = useState(false)
  const [loadingW, setLoadingW] = useState(false)

  const selectedCounty = counties.find((c) => c.id === countyId)
  const selectedConstituency = constituencies.find((c) => c.id === constituencyId)
  const selectedWard = wards.find((w) => w.id === wardId)

  useEffect(() => {
    if (!countyId) {
      setConstituencies([])
      setWards([])
      return
    }
    setLoadingC(true)
    userApi
      .getConstituencies(countyId)
      .then(setConstituencies)
      .catch(() => setConstituencies([]))
      .finally(() => setLoadingC(false))
  }, [countyId])

  useEffect(() => {
    if (!constituencyId) {
      setWards([])
      return
    }
    setLoadingW(true)
    userApi
      .getWards(constituencyId)
      .then(setWards)
      .catch(() => setWards([]))
      .finally(() => setLoadingW(false))
  }, [constituencyId])

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-chai">{heading}</p>

      <div>
        <Label className="text-xs text-warm-gray mb-1 block">County</Label>
        <Select
          value={countyId}
          onValueChange={(v) => {
            onCountyChange(v)
            onConstituencyChange("")
            onWardChange("")
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select county…" />
          </SelectTrigger>
          <SelectContent>
            {counties.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-warm-gray mb-1 block">Constituency</Label>
        <Select
          value={constituencyId}
          onValueChange={(v) => {
            onConstituencyChange(v)
            onWardChange("")
          }}
          disabled={!countyId || loadingC}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingC ? "Loading…" : "Select constituency…"} />
          </SelectTrigger>
          <SelectContent>
            {constituencies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-warm-gray mb-1 block">Ward / community</Label>
        <Select
          value={wardId}
          onValueChange={onWardChange}
          disabled={!constituencyId || loadingW}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingW ? "Loading…" : "Select your ward…"} />
          </SelectTrigger>
          <SelectContent>
            {wards.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Community confirmation — appears once ward is selected */}
      {selectedWard && (
        <div
          className="flex items-center gap-1.5 flex-wrap px-3 py-2.5 rounded-xl text-[12px] font-medium"
          style={{
            background: "rgba(29,71,49,0.07)",
            border: "1px solid rgba(29,71,49,0.14)",
          }}
        >
          <span style={{ color: "rgba(14,11,8,0.45)" }}>Joining</span>
          <span className="font-bold" style={{ color: "#1D4731" }}>
            {selectedWard.name}
          </span>
          {selectedConstituency && (
            <>
              <span style={{ color: "rgba(14,11,8,0.30)" }}>›</span>
              <span style={{ color: "#2A6B7C" }}>{selectedConstituency.name}</span>
            </>
          )}
          {selectedCounty && (
            <>
              <span style={{ color: "rgba(14,11,8,0.30)" }}>›</span>
              <span style={{ color: "#7A4F1E" }}>{selectedCounty.name}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
