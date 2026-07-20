"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { Store, Search, Plus, Phone, X, ShieldCheck, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { marketplaceApi, type MarketplaceListingDto } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useSectionTour } from "@/hooks/use-section-tour"
import { marketplaceTour } from "@/lib/tours"
import { TourButton } from "@/components/onboarding/tour-button"

// ─── Type filter ──────────────────────────────────────────
type TypeFilter = "ALL" | "OFFER" | "REQUEST"

const TYPE_LABELS: Record<TypeFilter, string> = {
  ALL: "All",
  OFFER: "Offers",
  REQUEST: "Requests",
}

// ─── Listing card ─────────────────────────────────────────
function ListingCard({
  listing,
  onDeactivate,
  isOwn,
}: {
  listing: MarketplaceListingDto
  onDeactivate?: (id: string) => void
  isOwn?: boolean
}) {
  const isOffer = listing.listingType === "OFFER"
  return (
    <Card className="border-0 shadow-card overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={
                  isOffer
                    ? { background: "rgba(30,61,47,0.1)", color: "#1E3D2F" }
                    : { background: "rgba(201,146,42,0.12)", color: "#C9922A" }
                }
              >
                {isOffer ? "Offer" : "Request"}
              </span>
              {listing.status === "INACTIVE" && (
                <Badge variant="secondary" className="text-[10px]">
                  Inactive
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-[#0E0B08] text-base leading-snug truncate">{listing.title}</h3>
          </div>
          {listing.price > 0 && (
            <p className="text-sm font-bold text-[#C9922A] flex-shrink-0">
              KES {listing.price.toLocaleString()}
            </p>
          )}
        </div>

        <p className="text-xs text-[#0E0B08]/60 leading-relaxed line-clamp-2 mb-4">{listing.description}</p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
              style={{ background: "#1E3D2F" }}
            >
              {listing.sellerUser?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="text-xs text-[#0E0B08]/60 truncate">
              {listing.sellerUser?.name ?? "Member"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {listing.sellerUser?.phoneNumber && (
              <a
                href={`tel:${listing.sellerUser.phoneNumber}`}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
              >
                <Phone className="h-3 w-3" />
                Contact
              </a>
            )}
            {isOwn && listing.status === "ACTIVE" && onDeactivate && (
              <button
                onClick={() => onDeactivate(listing.id)}
                className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(176,58,30,0.1)", color: "#B03A1E" }}
              >
                <X className="h-3 w-3 mr-0.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Create listing modal ─────────────────────────────────
function CreateListingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "OFFER" as "OFFER" | "REQUEST",
    priceGuideKes: "",
  })
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: () =>
      marketplaceApi.createListing({
        title: form.title,
        description: form.description,
        type: form.type,
        priceGuideKes: form.priceGuideKes ? parseInt(form.priceGuideKes) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] })
      queryClient.invalidateQueries({ queryKey: ["marketplace-mine"] })
      onClose()
    },
    onError: (e: any) => setError(e?.message ?? "Failed to create listing"),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">New Listing</CardTitle>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5">
            <X className="h-4 w-4 text-[#0E0B08]/60" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["OFFER", "REQUEST"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className="rounded-xl py-2 text-sm font-semibold transition-all"
                style={
                  form.type === t
                    ? { background: "#1E3D2F", color: "#fff" }
                    : { background: "rgba(26,18,11,0.06)", color: "rgba(14,11,8,0.6)" }
                }
              >
                {t === "OFFER" ? "I'm offering" : "I'm looking for"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Title</Label>
            <Input
              placeholder="e.g. Plumbing repair services"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description</Label>
            <Textarea
              placeholder="Describe what you're offering or looking for..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="text-sm resize-none"
              rows={3}
            />
          </div>

          {form.type === "OFFER" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Price guide (KES) — optional</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.priceGuideKes}
                onChange={(e) => setForm((f) => ({ ...f, priceGuideKes: e.target.value }))}
                className="text-sm"
              />
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#B03A1E" }}>{error}</p>}

          <Button
            className="w-full font-semibold"
            style={{ background: "#1E3D2F", color: "#fff" }}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.title.trim() || !form.description.trim()}
          >
            {mutation.isPending ? "Publishing…" : "Publish Listing"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────
export default function MarketplacePage() {
  const { isAuthenticated, user } = useAuth()
  const { replay: replayTour } = useSectionTour(marketplaceTour.key, marketplaceTour.steps)
  const isCommunityVerified =
    user?.verificationLevel === "COMMUNITY_VERIFIED" ||
    user?.verificationLevel === "FULL_VERIFIED"
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"browse" | "mine">("browse")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")
  const [showCreate, setShowCreate] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [committedSearch, setCommittedSearch] = useState("")
  const [myWardOnly, setMyWardOnly] = useState(false)

  const wardId = myWardOnly ? (user?.primaryWardId ?? undefined) : undefined

  const browseQuery = useQuery({
    queryKey: ["marketplace-browse", typeFilter, committedSearch, wardId],
    queryFn: () =>
      marketplaceApi.searchListings({
        type: typeFilter === "ALL" ? undefined : typeFilter,
        q: committedSearch || undefined,
        wardId,
        limit: 30,
      }),
    staleTime: 60_000,
  })

  const myQuery = useQuery({
    queryKey: ["marketplace-mine"],
    queryFn: () => marketplaceApi.getMyListings({ limit: 30 }),
    enabled: isAuthenticated && isCommunityVerified && activeTab === "mine",
    staleTime: 30_000,
  })

  const deactivateMutation = useMutation({
    mutationFn: (listingId: string) => marketplaceApi.deactivateListing(listingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-mine"] })
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] })
    },
  })

  const browseListings = browseQuery.data?.listings ?? []
  const myListings = myQuery.data?.listings ?? []

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-6">
      {/* Photo hero */}
      <div className="relative h-36 rounded-2xl overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80"
          alt="Marketplace"
          fill
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(29,71,49,0.82) 0%, rgba(29,71,49,0.50) 100%)" }}
        />
        <div className="absolute inset-0 flex items-end justify-between p-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-4 w-4 text-white/70" />
              <span className="text-white/70 text-xs font-medium uppercase tracking-wide">Discovery Only</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-white">Marketplace</h1>
            <p className="text-white/70 text-sm mt-0.5">Goods &amp; services by ward members</p>
          </div>
          <div className="flex items-center gap-2 self-end flex-shrink-0">
            <TourButton onClick={replayTour} />
            {isAuthenticated && isCommunityVerified && (
              <Button
                size="sm"
                data-tour="marketplace-create"
                className="font-semibold gap-1.5"
                style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" />
                List
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Verification gate banner */}
      {isAuthenticated && !isCommunityVerified && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: "rgba(201,146,42,0.08)", border: "1px solid rgba(201,146,42,0.2)" }}
        >
          <ShieldCheck className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "#C9922A" }} />
          <div>
            <p className="text-sm font-semibold text-[#0E0B08]">Community verification required to list</p>
            <p className="text-xs text-[#0E0B08]/60 mt-0.5 leading-relaxed">
              You can browse all listings freely. To post your own offer or request, you need to be a
              community-verified ward member. Complete your verification through your ward group.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {isAuthenticated && isCommunityVerified && (
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(26,18,11,0.06)" }}>
          {(["browse", "mine"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize"
              style={
                activeTab === tab
                  ? { background: "#fff", color: "#0E0B08", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                  : { color: "rgba(14,11,8,0.5)" }
              }
            >
              {tab === "browse" ? "Browse" : "My Listings"}
            </button>
          ))}
        </div>
      )}

      {/* Search bar + filters — browse only */}
      {activeTab === "browse" && (
        <div className="space-y-3">
          {/* Search input */}
          <form
            onSubmit={(e) => { e.preventDefault(); setCommittedSearch(searchInput.trim()) }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0E0B08]/30 pointer-events-none" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                if (!e.target.value.trim()) setCommittedSearch("")
              }}
              placeholder="Search listings…"
              className="w-full h-10 pl-9 pr-10 rounded-xl border border-black/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C9922A]/30"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setCommittedSearch("") }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/5 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-[#0E0B08]/40" />
              </button>
            )}
          </form>

          {/* Type chips + ward toggle */}
          <div className="flex items-center gap-2 flex-wrap" data-tour="marketplace-filters">
            {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all"
                style={
                  typeFilter === t
                    ? { background: "#C9922A", color: "#fff" }
                    : { background: "rgba(201,146,42,0.1)", color: "#C9922A" }
                }
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
            {isAuthenticated && user?.primaryWardId && (
              <button
                onClick={() => setMyWardOnly((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
                style={
                  myWardOnly
                    ? { background: "#1D4731", color: "#fff" }
                    : { background: "rgba(29,71,49,0.08)", color: "#1D4731" }
                }
              >
                <MapPin className="h-3 w-3" />
                {user.primaryWardName ?? "My ward"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Browse listings */}
      {activeTab === "browse" && (
        <>
          {browseQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : browseListings.length === 0 ? (
            <Card className="border-0 shadow-card text-center py-16">
              <CardContent>
                <Store className="h-10 w-10 mx-auto mb-3" style={{ color: "rgba(14,11,8,0.15)" }} />
                <p className="font-semibold text-[#0E0B08]/50">No listings yet</p>
                <p className="text-xs text-[#0E0B08]/35 mt-1">
                  Be the first to list a skill or service in your ward.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {browseListings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </>
      )}

      {/* My listings */}
      {activeTab === "mine" && (
        <>
          {myQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : myListings.length === 0 ? (
            <Card className="border-0 shadow-card text-center py-16">
              <CardContent>
                <Search className="h-10 w-10 mx-auto mb-3" style={{ color: "rgba(14,11,8,0.15)" }} />
                <p className="font-semibold text-[#0E0B08]/50">No listings yet</p>
                <p className="text-xs text-[#0E0B08]/35 mt-1">
                  Click &ldquo;List&rdquo; to publish your first offer or request.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isOwn
                  onDeactivate={(id) => deactivateMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && <CreateListingModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
