"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { communityApi, governanceApi } from "@/lib/api"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import Link from "next/link"

type ProposalType = "COMMUNITY_INITIATIVE" | "MAJOR_PROJECT" | "STRATEGIC_DECISION" | "EMERGENCY"
type ProposalScope = "GROUP" | "COMMUNITY"

const PROPOSAL_TYPE_META: Record<ProposalType, { label: string; description: string }> = {
  COMMUNITY_INITIATIVE: {
    label: "Community Initiative",
    description: "A practical project or service improvement for the ward.",
  },
  MAJOR_PROJECT: {
    label: "Major Project",
    description: "Large-scale infrastructure or multi-phase work requiring detailed planning.",
  },
  STRATEGIC_DECISION: {
    label: "Strategic Decision",
    description: "A policy, direction, or governance matter for the group or location.",
  },
  EMERGENCY: {
    label: "Emergency",
    description: "Urgent action required — shorter review and voting window.",
  },
}

const STEPS = ["Group & Type", "Problem & Solution", "Budget & Submit"] as const

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex-1 flex items-center">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                i < step
                  ? "bg-[#1D4731] border-[#1D4731] text-cream"
                  : i === step
                  ? "bg-amber border-amber text-[#0A1F14]"
                  : "bg-white border-cream text-warm-gray"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-[10px] font-medium whitespace-nowrap ${i === step ? "text-amber" : "text-warm-gray"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < step ? "bg-[#1D4731]" : "bg-cream"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-[#0A1F14]">{label}</label>
      {hint && <p className="text-xs text-warm-gray -mt-0.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

const inputCls =
  "w-full h-10 rounded-lg border border-cream bg-white px-3 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40"
const textareaCls =
  "w-full rounded-lg border border-cream bg-white px-3 py-2.5 text-sm text-[#0A1F14] placeholder:text-warm-gray/60 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"

function CreateProposalForm() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthenticated, user } = useAuth()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(0)

  // Step 1
  const [groupId, setGroupId] = useState(searchParams.get("groupId") ?? "")
  const [proposalType, setProposalType] = useState<ProposalType>("COMMUNITY_INITIATIVE")
  const [proposalScope, setProposalScope] = useState<ProposalScope>("COMMUNITY")
  const [title, setTitle] = useState("")

  // Step 2
  const [problem, setProblem] = useState("")
  const [solution, setSolution] = useState("")
  const [outcomes, setOutcomes] = useState("")
  const [timeline, setTimeline] = useState("")
  const [team, setTeam] = useState("")

  // Step 3
  const [fundingAmountKes, setFundingAmountKes] = useState("")
  const [groupFundingAmount, setGroupFundingAmount] = useState("")
  const [locationFundingRequest, setLocationFundingRequest] = useState("")

  const { data: memberships = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => communityApi.getMyGroups(),
    enabled: isAuthenticated,
  })

  const selectedGroup = memberships.find((m) => m.groupId === groupId) ?? null
  const isVoluntary = !!selectedGroup?.voluntaryType
  const hasLocation = !!(selectedGroup?.ward || selectedGroup?.constituency || selectedGroup?.county)
  const isGroupScoped = proposalScope === "GROUP"
  const isDetailedType = proposalType === "MAJOR_PROJECT" || proposalType === "STRATEGIC_DECISION"

  // Compiled description sent to backend
  function buildDescription(): string {
    const parts: string[] = []
    parts.push(`**Problem**\n${problem.trim()}`)
    parts.push(`**Proposed Solution**\n${solution.trim()}`)
    if (outcomes.trim()) parts.push(`**Expected Outcomes**\n${outcomes.trim()}`)
    if (isDetailedType) {
      if (timeline.trim()) parts.push(`**Execution Timeline**\n${timeline.trim()}`)
      if (team.trim()) parts.push(`**Team / Responsible Parties**\n${team.trim()}`)
    }
    return parts.join("\n\n")
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () =>
      governanceApi.createProposal({
        groupId,
        title: title.trim(),
        description: buildDescription(),
        ...(fundingAmountKes ? { fundingAmountKes: Number(fundingAmountKes) } : {}),
        ...(proposalType === "EMERGENCY" ? { isEmergency: true } : {}),
        proposalScope,
        ...(groupFundingAmount ? { groupFundingAmount: Number(groupFundingAmount) } : {}),
        ...(!isGroupScoped && locationFundingRequest ? { locationFundingRequest: Number(locationFundingRequest) } : {}),
      }),
    onSuccess: () => {
      toast({ title: "Proposal created", description: "It is now a draft — your group leader can forward it for review." })
      router.push("/proposals")
    },
    onError: (err: any) => {
      toast({ title: "Failed to create proposal", description: err?.message ?? "Please try again.", variant: "destructive" })
    },
  })

  // Validation per step
  const step1Valid = !!groupId && title.trim().length >= 10
  const step2Valid = problem.trim().length >= 30 && solution.trim().length >= 30
  const step3Valid = true // budget is optional

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-warm-gray text-sm">
        Sign in to create a proposal.
      </div>
    )
  }

  const canCreate = user?.verificationLevel === "COMMUNITY_VERIFIED" || user?.verificationLevel === "FULL_VERIFIED"
  if (!canCreate) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
        <p className="text-warm-gray text-sm">
          You need <strong>Community Verification</strong> to create a proposal.
        </p>
        <Link href="/profile" className="text-amber text-sm underline underline-offset-2">
          Complete verification →
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-2xl space-y-5 md:space-y-6">
      <Link
        href="/proposals"
        className="inline-flex items-center gap-1.5 text-sm text-warm-gray hover:text-amber transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to proposals
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#0A1F14]" style={{ fontFamily: "var(--font-cormorant, serif)" }}>
          Create a Proposal
        </h1>
        <p className="mt-1 text-sm text-warm-gray">
          Proposals go through your group leader, then the relevant location administrator, before opening for a vote.
        </p>
      </div>

      <StepBar step={step} />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 md:p-6 space-y-5">
          {/* ── STEP 1: Group & Type ─────────────────────────────────────── */}
          {step === 0 && (
            <>
              <Field label="Group *" hint="Which group is putting this proposal forward?">
                {loadingGroups ? (
                  <div className="h-10 rounded-lg bg-cream animate-pulse" />
                ) : memberships.length === 0 ? (
                  <p className="text-sm text-warm-gray">You are not a member of any group yet.</p>
                ) : (
                  <select
                    value={groupId}
                    onChange={(e) => { setGroupId(e.target.value); setProposalScope("COMMUNITY") }}
                    className={inputCls}
                  >
                    <option value="">Select a group…</option>
                    {memberships.map((m) => (
                      <option key={m.groupId} value={m.groupId}>
                        {m.groupName}
                        {m.role === "LEADER" ? " (you are leader)" : ""}
                        {m.voluntaryType ? " — voluntary" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {/* Proposal scope — only for voluntary groups */}
              {isVoluntary && (
                <Field
                  label="Proposal Scope *"
                  hint="Internal proposals stay within your group. Public proposals go to a community vote and may request location funding."
                >
                  <div className="grid grid-cols-2 gap-3">
                    {(["COMMUNITY", "GROUP"] as ProposalScope[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setProposalScope(s)}
                        className={`rounded-lg border px-4 py-3 text-left transition-all ${
                          proposalScope === s
                            ? "border-amber bg-amber/10 ring-1 ring-amber"
                            : "border-cream bg-white hover:border-amber/40"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#0A1F14]">{s === "GROUP" ? "Internal" : "Public"}</p>
                        <p className="text-xs text-warm-gray mt-0.5">
                          {s === "GROUP"
                            ? "Only your group members vote. No location admin review required."
                            : "Goes to a location-wide vote. Requires location admin approval first."}
                        </p>
                      </button>
                    ))}
                  </div>
                  {isVoluntary && proposalScope === "COMMUNITY" && !hasLocation && (
                    <p className="mt-2 text-xs text-amber font-medium">
                      Your group has no location affiliation. A public proposal will be blocked at review unless a ward, constituency, or county is associated with the group.
                    </p>
                  )}
                </Field>
              )}

              <Field label="Proposal Type *" hint="Choose what kind of action this is.">
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(PROPOSAL_TYPE_META) as ProposalType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProposalType(type)}
                      className={`rounded-lg border px-4 py-2.5 text-left transition-all ${
                        proposalType === type
                          ? "border-amber bg-amber/10 ring-1 ring-amber"
                          : "border-cream bg-white hover:border-amber/40"
                      }`}
                    >
                      <span className="text-sm font-semibold text-[#0A1F14]">{PROPOSAL_TYPE_META[type].label}</span>
                      <span className="ml-2 text-xs text-warm-gray">{PROPOSAL_TYPE_META[type].description}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Title *"
                error={title.trim().length > 0 && title.trim().length < 10 ? "Minimum 10 characters" : undefined}
              >
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Drill a borehole on Kirinyaga Road"
                  maxLength={200}
                  className={inputCls}
                />
                <p className="text-xs text-right text-warm-gray">{title.length}/200</p>
              </Field>
            </>
          )}

          {/* ── STEP 2: Problem & Solution ──────────────────────────────── */}
          {step === 1 && (
            <>
              <Field
                label="What is the problem? *"
                hint="Describe the specific issue affecting the community. Who is affected and how?"
                error={problem.trim().length > 0 && problem.trim().length < 30 ? "Minimum 30 characters" : undefined}
              >
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="e.g. Residents on Kirinyaga Road walk over 2 km to the nearest water point. During dry seasons the hand pump at the primary school fails, affecting 400 households."
                  rows={4}
                  maxLength={1500}
                  className={textareaCls}
                />
                <p className="text-xs text-right text-warm-gray">{problem.length}/1500</p>
              </Field>

              <Field
                label="What is the proposed solution? *"
                hint="How does this proposal address the problem? Be specific about what will be done."
                error={solution.trim().length > 0 && solution.trim().length < 30 ? "Minimum 30 characters" : undefined}
              >
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="e.g. Drill and equip a borehole at the primary school grounds, install a solar pump, and set up a 5,000-litre overhead tank accessible to surrounding households."
                  rows={4}
                  maxLength={1500}
                  className={textareaCls}
                />
                <p className="text-xs text-right text-warm-gray">{solution.length}/1500</p>
              </Field>

              <Field
                label="Expected outcomes"
                hint="Who benefits and what changes? Optional but helps reviewers evaluate impact."
              >
                <textarea
                  value={outcomes}
                  onChange={(e) => setOutcomes(e.target.value)}
                  placeholder="e.g. ~400 households gain reliable water access within 500 m. School sanitation improves. Reduces time burden on women and children collecting water."
                  rows={3}
                  maxLength={800}
                  className={textareaCls}
                />
              </Field>

              {isDetailedType && (
                <>
                  <Field
                    label="Execution timeline"
                    hint="Outline key phases and estimated durations. Optional but required for major projects."
                  >
                    <textarea
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      placeholder="e.g. Month 1: hydrogeological survey. Month 2–3: drilling and casing. Month 4: pump installation and testing. Month 5: commissioning."
                      rows={3}
                      maxLength={800}
                      className={textareaCls}
                    />
                  </Field>

                  <Field
                    label="Team / Responsible parties"
                    hint="Who will oversee or carry out the work?"
                  >
                    <textarea
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                      placeholder="e.g. Supervised by the group treasurer and two elected oversight members. Contractor to be sourced via county procurement process."
                      rows={3}
                      maxLength={800}
                      className={textareaCls}
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {/* ── STEP 3: Budget & Submit ──────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="rounded-lg bg-cream/50 border border-cream px-4 py-3 text-xs text-warm-gray space-y-1">
                <p className="font-semibold text-[#0A1F14] text-sm">{title}</p>
                <p>Type: {PROPOSAL_TYPE_META[proposalType].label} · Scope: {isGroupScoped ? "Internal" : "Public"}</p>
                {selectedGroup && <p>Group: {selectedGroup.groupName}</p>}
              </div>

              <Field
                label="Total budget needed (KES)"
                hint="The full cost of this proposal. Leave blank if no funding is needed."
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-warm-gray">KES</span>
                  <input
                    type="number"
                    value={fundingAmountKes}
                    onChange={(e) => setFundingAmountKes(e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full h-10 rounded-lg border border-cream bg-white pl-12 pr-3 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/40"
                  />
                </div>
              </Field>

              {fundingAmountKes && Number(fundingAmountKes) > 0 && (
                <div className="space-y-4 pl-4 border-l-2 border-cream">
                  <p className="text-xs text-warm-gray font-medium">How will the funding be sourced?</p>

                  <Field
                    label="Group treasury contribution (KES)"
                    hint="Amount your group commits from its own treasury."
                  >
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-warm-gray">KES</span>
                      <input
                        type="number"
                        value={groupFundingAmount}
                        onChange={(e) => setGroupFundingAmount(e.target.value)}
                        placeholder="0"
                        min={0}
                        className="w-full h-10 rounded-lg border border-cream bg-white pl-12 pr-3 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/40"
                      />
                    </div>
                  </Field>

                  {!isGroupScoped && (
                    <Field
                      label="Location funding request (KES)"
                      hint="Amount requested from the ward, constituency, or county treasury. Requires administrator approval."
                    >
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-warm-gray">KES</span>
                        <input
                          type="number"
                          value={locationFundingRequest}
                          onChange={(e) => setLocationFundingRequest(e.target.value)}
                          placeholder="0"
                          min={0}
                          className="w-full h-10 rounded-lg border border-cream bg-white pl-12 pr-3 text-sm text-[#0A1F14] focus:outline-none focus:ring-2 focus:ring-amber/40"
                        />
                      </div>
                    </Field>
                  )}
                </div>
              )}

              <p className="text-xs text-warm-gray pt-2">
                Once created, this proposal is a <strong>draft</strong>. Your group leader forwards it for review, then the appropriate location administrator approves it before it goes to a vote.
              </p>
            </>
          )}

          {/* ── Navigation buttons ─────────────────────────────────────── */}
          <div className={`flex gap-3 pt-2 ${step > 0 ? "justify-between" : "justify-end"}`}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold border border-cream text-[#0A1F14] hover:bg-cream/60 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 ? !step1Valid : !step2Valid}
                className="flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: "#D4911E", color: "#0A1F14" }}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submit()}
                disabled={isPending || !step3Valid}
                className="flex items-center gap-1.5 rounded-full px-6 py-2 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: "#D4911E", color: "#0A1F14" }}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isPending ? "Creating…" : "Create Proposal"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


export default function CreateProposalPage() {
  return (
    <Suspense>
      <CreateProposalForm />
    </Suspense>
  )
}
