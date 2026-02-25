"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { userApi, ApiError } from "@/lib/api"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  User,
  Phone,
  MapPin,
  Briefcase,
  ExternalLink,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────

interface RefItem { id: string; name: string }

interface FormData {
  email: string
  name: string
  phoneNumber: string
  primaryCountyId: string
  primaryConstituencyId: string
  primaryWardId: string
  secondaryCountyId: string
  secondaryConstituencyId: string
  secondaryWardId: string
  industryIds: string[]
  goodsServiceIds: string[]
}

const STEPS = [
  { label: "Account", icon: User },
  { label: "Residence", icon: MapPin },
  { label: "Origin", icon: MapPin },
  { label: "Economy", icon: Briefcase },
]

const IS_DEV = process.env.NODE_ENV === "development"

// ── Helpers ──────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
                    : "bg-slate-100 text-slate-400",
                ].join(" ")}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={[
                  "text-[10px] font-medium hidden sm:block",
                  active ? "text-orange-600" : done ? "text-green-600" : "text-slate-400",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "flex-1 h-0.5 mx-2 mt-[-12px] rounded-full transition-all",
                  done ? "bg-green-400" : "bg-slate-200",
                ].join(" ")}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function WardCascade({
  label,
  prefix,
  countyId,
  constituencyId,
  wardId,
  counties,
  onCountyChange,
  onConstituencyChange,
  onWardChange,
}: {
  label: string
  prefix: string
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

  useEffect(() => {
    if (!countyId) { setConstituencies([]); setWards([]); return }
    setLoadingC(true)
    userApi.getConstituencies(countyId)
      .then(setConstituencies)
      .catch(() => setConstituencies([]))
      .finally(() => setLoadingC(false))
  }, [countyId])

  useEffect(() => {
    if (!constituencyId) { setWards([]); return }
    setLoadingW(true)
    userApi.getWards(constituencyId)
      .then(setWards)
      .catch(() => setWards([]))
      .finally(() => setLoadingW(false))
  }, [constituencyId])

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">{label}</p>

      <div>
        <Label className="text-xs text-slate-500 mb-1 block">County</Label>
        <Select value={countyId} onValueChange={(v) => { onCountyChange(v); onConstituencyChange(""); onWardChange("") }}>
          <SelectTrigger>
            <SelectValue placeholder="Select county…" />
          </SelectTrigger>
          <SelectContent>
            {counties.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1 block">Constituency</Label>
        <Select
          value={constituencyId}
          onValueChange={(v) => { onConstituencyChange(v); onWardChange("") }}
          disabled={!countyId || loadingC}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingC ? "Loading…" : "Select constituency…"} />
          </SelectTrigger>
          <SelectContent>
            {constituencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1 block">Ward</Label>
        <Select
          value={wardId}
          onValueChange={onWardChange}
          disabled={!constituencyId || loadingW}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingW ? "Loading…" : "Select ward…"} />
          </SelectTrigger>
          <SelectContent>
            {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────

export function RegisterForm() {
  const { requestMagicLink } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const [counties, setCounties] = useState<RefItem[]>([])
  const [industries, setIndustries] = useState<RefItem[]>([])
  const [goodsServices, setGoodsServices] = useState<RefItem[]>([])

  const [form, setForm] = useState<FormData>({
    email: "",
    name: "",
    phoneNumber: "",
    primaryCountyId: "",
    primaryConstituencyId: "",
    primaryWardId: "",
    secondaryCountyId: "",
    secondaryConstituencyId: "",
    secondaryWardId: "",
    industryIds: [],
    goodsServiceIds: [],
  })

  // Load reference data once
  useEffect(() => {
    userApi.getCounties().then(setCounties).catch(() => {})
    userApi.getIndustries().then(setIndustries).catch(() => {})
    userApi.getGoodsServices().then(setGoodsServices).catch(() => {})
  }, [])

  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  )

  const toggleMulti = useCallback((key: "industryIds" | "goodsServiceIds", id: string, max: number) => {
    setForm((prev) => {
      const current = prev[key]
      if (current.includes(id)) return { ...prev, [key]: current.filter((x) => x !== id) }
      if (current.length >= max) return prev
      return { ...prev, [key]: [...current, id] }
    })
  }, [])

  // ── Step validation ──────────────────────────────────

  const canAdvance = () => {
    if (step === 0) return form.email.trim() && form.name.trim() && form.phoneNumber.trim()
    if (step === 1) return form.primaryWardId
    if (step === 2) return form.secondaryWardId
    if (step === 3) return form.industryIds.length > 0 && form.goodsServiceIds.length > 0
    return false
  }

  // ── Submit ───────────────────────────────────────────

  const handleSubmit = async () => {
    setError("")
    setSubmitting(true)
    try {
      await requestMagicLink({
        email: form.email.trim(),
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.trim(),
        primaryWardId: form.primaryWardId,
        secondaryWardId: form.secondaryWardId,
        industryIds: form.industryIds,
        goodsServiceIds: form.goodsServiceIds,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Done screen ──────────────────────────────────────

  if (done) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-5xl">📬</div>
        <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
        <p className="text-slate-600 text-sm max-w-sm mx-auto">
          We sent a login link to <strong>{form.email}</strong>. Click the link to
          activate your account and sign in.
        </p>
        {IS_DEV && (
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs bg-orange-50 border border-orange-200 text-orange-700 rounded-md px-3 py-2 hover:bg-orange-100 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Dev mode — open MailHog to view your email (localhost:8025)
          </a>
        )}
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/")}>
            Back to home
          </Button>
        </div>
      </div>
    )
  }

  // ── Step panels ──────────────────────────────────────

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {/* Step 0 — Account basics */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-9"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div>
            <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="name"
                placeholder="Amina Wanjiku"
                className="pl-9"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="text-sm font-medium">Phone number</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="+254 700 000 000"
                className="pl-9"
                value={form.phoneNumber}
                onChange={(e) => set("phoneNumber", e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Used for community verification later</p>
          </div>
        </div>
      )}

      {/* Step 1 — Primary residence (where you live now) */}
      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 mb-4">
            Select the ward where you currently live. This determines which community projects
            and governance you participate in.
          </p>
          <WardCascade
            label="Where do you currently live?"
            prefix="primary"
            countyId={form.primaryCountyId}
            constituencyId={form.primaryConstituencyId}
            wardId={form.primaryWardId}
            counties={counties}
            onCountyChange={(v) => set("primaryCountyId", v)}
            onConstituencyChange={(v) => set("primaryConstituencyId", v)}
            onWardChange={(v) => set("primaryWardId", v)}
          />
        </div>
      )}

      {/* Step 2 — Origin / Secondary ward */}
      {step === 2 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 mb-4">
            Select your home area — where you are originally from. This connects you to
            your ancestral ward&apos;s community even while living elsewhere.
          </p>
          <WardCascade
            label="Where are you originally from?"
            prefix="secondary"
            countyId={form.secondaryCountyId}
            constituencyId={form.secondaryConstituencyId}
            wardId={form.secondaryWardId}
            counties={counties}
            onCountyChange={(v) => set("secondaryCountyId", v)}
            onConstituencyChange={(v) => set("secondaryConstituencyId", v)}
            onWardChange={(v) => set("secondaryWardId", v)}
          />
        </div>
      )}

      {/* Step 3 — Economic profile */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              Your industries{" "}
              <span className="font-normal text-slate-400">(pick 1–3)</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">What sector do you work in?</p>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {industries.map((ind) => {
                const selected = form.industryIds.includes(ind.id)
                return (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => toggleMulti("industryIds", ind.id, 3)}
                    className={[
                      "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                      selected
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-orange-300",
                    ].join(" ")}
                  >
                    {ind.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              Goods &amp; services{" "}
              <span className="font-normal text-slate-400">(pick at least 1)</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">What can you offer or need in the community?</p>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {goodsServices.map((gs) => {
                const selected = form.goodsServiceIds.includes(gs.id)
                return (
                  <button
                    key={gs.id}
                    type="button"
                    onClick={() => toggleMulti("goodsServiceIds", gs.id, 20)}
                    className={[
                      "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                      selected
                        ? "bg-green-500 border-green-500 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-green-300",
                    ].join(" ")}
                  >
                    {gs.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}

        {step < 3 ? (
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={handleSubmit}
            disabled={submitting || !canAdvance()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating account…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Create account
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
