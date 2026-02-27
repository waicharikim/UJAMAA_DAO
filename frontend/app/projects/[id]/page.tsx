"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MilestoneTracker } from "@/components/projects/milestone-tracker"
import { useAuth } from "@/contexts/auth-context"
import { Calendar, Users, DollarSign, MapPin, TrendingUp, Clock, Target, ArrowLeft } from "lucide-react"
import type { Project, ProjectMilestone } from "@/lib/types/projects"

// ── Chai palette helpers ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  PLANNING:  { label: "Planning",   bg: "rgba(212,145,30,0.12)",  color: "#C9922A" },
  ACTIVE:    { label: "Active",     bg: "rgba(30,61,47,0.12)",    color: "#1E3D2F" },
  COMPLETED: { label: "Completed",  bg: "rgba(42,82,64,0.12)",    color: "#2A5240" },
  ON_HOLD:   { label: "On Hold",    bg: "rgba(176,58,30,0.1)",    color: "#B03A1E" },
  CANCELLED: { label: "Cancelled",  bg: "rgba(176,58,30,0.12)",   color: "#B03A1E" },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, bg: "rgba(26,18,11,0.08)", color: "rgba(26,18,11,0.5)" }
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function InfoCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{
        background: "linear-gradient(135deg, #FAF7F2 0%, #F6F0E6 100%)",
        border: "1px solid rgba(212,145,30,0.14)",
      }}
    >
      {children}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProject()
  }, [params.id])

  const loadProject = async () => {
    try {
      setLoading(true)
      const mockProject: Project = {
        id: params.id as string,
        proposalId: "prop-1",
        title: "Community Solar Energy Initiative",
        description:
          "Install solar panels in community centers across Westlands constituency to reduce energy costs and promote renewable energy adoption. This project aims to create sustainable energy solutions while building community capacity for green technology maintenance and operation.",
        locationScope: "CONSTITUENCY",
        constituency: "Westlands",
        status: "ACTIVE",
        budget: { total: 50000, allocated: 30000, disbursed: 15000, remaining: 35000 },
        timeline: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedDuration: 90,
        },
        participants: [
          {
            id: "p1",
            userId: user?.id || "user1",
            user: { id: user?.id || "user1", name: user?.username || "John Doe", email: user?.email || "john@example.com", avatarUrl: user?.avatar, impactPoints: 150 },
            role: "MANAGER",
            permissions: ["view_project", "edit_project", "create_milestone"],
            contribution: { description: "Project management and coordination", hoursCommitted: 40, skillsOffered: ["Project Management", "Solar Energy"], availability: "PART_TIME" },
            performance: { milestonesCompleted: 2, impactPointsEarned: 75, tokensEarned: 150, rating: 4.5, feedback: ["Great leadership", "Excellent communication"] },
            joinedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
            status: "ACTIVE",
          },
          {
            id: "p2",
            userId: "user2",
            user: { id: "user2", name: "Sarah Wilson", email: "sarah@example.com", impactPoints: 120 },
            role: "VERIFIER",
            permissions: ["view_project", "verify_milestones"],
            contribution: { description: "Technical verification and quality assurance", hoursCommitted: 20, skillsOffered: ["Solar Installation", "Quality Control"], availability: "PART_TIME" },
            performance: { milestonesCompleted: 1, impactPointsEarned: 45, tokensEarned: 90, rating: 4.8, feedback: ["Thorough verification process"] },
            joinedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            status: "ACTIVE",
          },
        ],
        milestones: [],
        createdBy: { id: "group1", name: "Green Energy Collective", type: "GROUP" },
        managedBy: { id: user?.id || "user1", name: user?.username || "John Doe", role: "PROJECT_MANAGER" },
        groupId: "group1",
        groupName: "Green Energy Collective",
        progress: { overall: 65, milestonesCompleted: 2, totalMilestones: 4, daysElapsed: 30, daysRemaining: 60 },
        impactMetrics: { participantsCount: 8, beneficiariesCount: 500, impactPointsGenerated: 320, tokensDistributed: 640 },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const mockMilestones: ProjectMilestone[] = [
        {
          id: "m1", projectId: params.id as string,
          title: "Site Assessment and Planning",
          description: "Conduct comprehensive site assessment for solar panel installation locations",
          requirements: ["Survey all potential installation sites", "Assess structural integrity of buildings", "Calculate energy requirements", "Obtain necessary permits"],
          deliverables: ["Site assessment report", "Installation plan document", "Permit applications", "Energy calculation spreadsheet"],
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: "COMPLETED", priority: "HIGH",
          funding: { allocated: 5000, disbursed: 5000, pending: 0 },
          assignedTo: [user?.id || "user1"],
          verifiedBy: { id: "user2", name: "Sarah Wilson", verifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), comments: "Excellent work on site assessment. All requirements met." },
          submissions: [{ id: "s1", milestoneId: "m1", submittedBy: { id: user?.id || "user1", name: user?.username || "John Doe" }, evidence: { description: "Completed comprehensive site assessment.", files: [], links: ["https://docs.google.com/spreadsheets/site-assessment"], metrics: { sitesAssessed: 5, permitsObtained: 3 } }, submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), status: "APPROVED", reviewComments: "Thorough assessment.", reviewedBy: { id: "user2", name: "Sarah Wilson", reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() } }],
          dependencies: [], progress: 100,
          impactPoints: { individual: 50, group: 25 }, tokenRewards: { individual: 100, group: 50 },
          createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "m2", projectId: params.id as string,
          title: "Equipment Procurement",
          description: "Source and purchase solar panels, inverters, and installation equipment",
          requirements: ["Research certified solar equipment suppliers", "Obtain quotes from multiple vendors", "Ensure equipment meets local standards", "Negotiate bulk purchase discounts"],
          deliverables: ["Vendor comparison report", "Purchase orders", "Equipment delivery schedule", "Quality certificates"],
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          status: "IN_PROGRESS", priority: "CRITICAL",
          funding: { allocated: 25000, disbursed: 0, pending: 25000 },
          assignedTo: [user?.id || "user1", "user3"],
          submissions: [], dependencies: ["m1"], progress: 40,
          impactPoints: { individual: 75, group: 40 }, tokenRewards: { individual: 150, group: 75 },
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(),
        },
        {
          id: "m3", projectId: params.id as string,
          title: "Installation and Setup",
          description: "Install solar panels and configure energy systems",
          requirements: ["Install solar panels on approved sites", "Set up inverters and electrical connections", "Configure monitoring systems", "Conduct safety testing"],
          deliverables: ["Installation completion report", "System configuration documentation", "Safety test results", "User operation manual"],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: "PENDING", priority: "HIGH",
          funding: { allocated: 15000, disbursed: 0, pending: 15000 },
          assignedTo: ["user2", "user4"],
          submissions: [], dependencies: ["m2"], progress: 0,
          impactPoints: { individual: 100, group: 50 }, tokenRewards: { individual: 200, group: 100 },
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(),
        },
        {
          id: "m4", projectId: params.id as string,
          title: "Community Training and Handover",
          description: "Train community members on system operation and maintenance",
          requirements: ["Develop training materials", "Conduct training sessions", "Establish maintenance schedule", "Create support documentation"],
          deliverables: ["Training curriculum", "Training completion certificates", "Maintenance schedule", "Support contact list"],
          dueDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
          status: "PENDING", priority: "MEDIUM",
          funding: { allocated: 5000, disbursed: 0, pending: 5000 },
          assignedTo: [user?.id || "user1", "user5"],
          submissions: [], dependencies: ["m3"], progress: 0,
          impactPoints: { individual: 60, group: 30 }, tokenRewards: { individual: 120, group: 60 },
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(),
        },
      ]

      setProject(mockProject)
      setMilestones(mockMilestones)
    } catch (error) {
      console.error("Failed to load project:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitMilestone = async (milestoneId: string, submission: unknown) => {
    console.log("Submitting milestone:", milestoneId, submission)
    await loadProject()
  }

  const handleVerifyMilestone = async (milestoneId: string, approved: boolean, comments: string) => {
    console.log("Verifying milestone:", milestoneId, approved, comments)
    await loadProject()
  }

  const handleCreateMilestone = () => {
    window.location.href = `/projects/${params.id}/milestones/create`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#C9922A] border-t-transparent" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-[#1A120B]/50 text-lg mb-4">Project not found</p>
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all"
          style={{ background: "rgba(212,145,30,0.12)", color: "#C9922A" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    )
  }

  const userParticipant = project.participants.find((p) => p.userId === user?.id)

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => window.history.back()}
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[rgba(201,146,42,0.1)]"
          style={{ border: "1px solid rgba(212,145,30,0.2)" }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: "#C9922A" }} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-3xl text-[#1A120B]">{project.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusBadge status={project.status} />
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "rgba(26,18,11,0.06)", color: "rgba(26,18,11,0.5)" }}
            >
              <MapPin className="h-3 w-3" />
              {project.locationScope}
            </span>
            {userParticipant && (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: "rgba(30,61,47,0.1)", color: "#1E3D2F" }}
              >
                {userParticipant.role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Project overview grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InfoCard>
            <h2 className="font-display font-bold text-lg text-[#1A120B] mb-3">Project Overview</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(26,18,11,0.6)" }}>
              {project.description}
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-[#1A120B]/60">Overall Progress</span>
                  <span className="font-bold text-[#C9922A]">{project.progress.overall}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(201,146,42,0.12)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${project.progress.overall}%`, background: "linear-gradient(to right, #C9922A, #E8B84B)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 flex-shrink-0" style={{ color: "#C9922A" }} />
                  <span className="text-sm text-[#1A120B]/60">
                    {project.progress.milestonesCompleted}/{project.progress.totalMilestones} milestones
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 flex-shrink-0" style={{ color: "#1E3D2F" }} />
                  <span className="text-sm text-[#1A120B]/60">{project.progress.daysRemaining} days remaining</span>
                </div>
              </div>
            </div>
          </InfoCard>
        </div>

        <div className="space-y-4">
          {/* Budget */}
          <InfoCard>
            <h3 className="font-display font-bold text-base text-[#1A120B] mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: "#C9922A" }} />
              Budget
            </h3>
            <dl className="space-y-2.5">
              {[
                { label: "Total Budget",  value: `KES ${project.budget.total.toLocaleString()}`,     color: "#1A120B" },
                { label: "Allocated",     value: `KES ${project.budget.allocated.toLocaleString()}`, color: "#1A120B" },
                { label: "Disbursed",     value: `KES ${project.budget.disbursed.toLocaleString()}`, color: "#1E3D2F" },
                { label: "Remaining",     value: `KES ${project.budget.remaining.toLocaleString()}`, color: "#C9922A" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt style={{ color: "rgba(26,18,11,0.5)" }}>{label}</dt>
                  <dd className="font-semibold" style={{ color }}>{value}</dd>
                </div>
              ))}
            </dl>
          </InfoCard>

          {/* Impact */}
          <InfoCard>
            <h3 className="font-display font-bold text-base text-[#1A120B] mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: "#1E3D2F" }} />
              Impact Metrics
            </h3>
            <dl className="space-y-2.5">
              {[
                { label: "Participants",    value: project.impactMetrics.participantsCount },
                { label: "Beneficiaries",   value: project.impactMetrics.beneficiariesCount },
                { label: "Impact Points",   value: project.impactMetrics.impactPointsGenerated },
                { label: "PR Distributed",  value: project.impactMetrics.tokensDistributed },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt style={{ color: "rgba(26,18,11,0.5)" }}>{label}</dt>
                  <dd className="font-semibold text-[#1A120B]">{value.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </InfoCard>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs defaultValue="milestones">
        <TabsList
          className="grid w-full grid-cols-4 rounded-xl p-1"
          style={{ background: "rgba(212,145,30,0.08)", border: "1px solid rgba(212,145,30,0.14)" }}
        >
          {["milestones", "participants", "budget", "reports"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-lg text-sm capitalize data-[state=active]:font-semibold"
              style={{ color: "rgba(26,18,11,0.55)" }}
            >
              {tab === "budget" ? "Budget & Funding" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="milestones" className="mt-6">
          <MilestoneTracker
            project={project}
            milestones={milestones}
            onSubmitMilestone={handleSubmitMilestone}
            onVerifyMilestone={handleVerifyMilestone}
            onCreateMilestone={handleCreateMilestone}
          />
        </TabsContent>

        <TabsContent value="participants" className="mt-6">
          <InfoCard>
            <h3 className="font-display font-bold text-lg text-[#1A120B] mb-5 flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: "#C9922A" }} />
              Project Participants
            </h3>
            <div className="space-y-3">
              {project.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: "rgba(201,146,42,0.05)", border: "1px solid rgba(201,146,42,0.1)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #2A5240, #1E3D2F)" }}
                    >
                      {participant.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1A120B]">{participant.user.name}</p>
                      <p className="text-xs" style={{ color: "rgba(26,18,11,0.5)" }}>{participant.contribution.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(30,61,47,0.1)", color: "#1E3D2F" }}
                    >
                      {participant.role}
                    </span>
                    <p className="text-xs mt-1" style={{ color: "rgba(26,18,11,0.45)" }}>
                      {participant.performance.impactPointsEarned} impact pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </InfoCard>
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InfoCard>
              <h3 className="font-display font-bold text-base text-[#1A120B] mb-4">Budget Breakdown</h3>
              <div className="space-y-3">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex justify-between items-center p-3 rounded-xl"
                    style={{ background: "rgba(201,146,42,0.05)", border: "1px solid rgba(201,146,42,0.1)" }}
                  >
                    <div>
                      <p className="font-medium text-sm text-[#1A120B]">{milestone.title}</p>
                      <p className="text-xs" style={{ color: "rgba(26,18,11,0.45)" }}>
                        {milestone.status} · {milestone.priority}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-[#1A120B]">KES {milestone.funding.allocated.toLocaleString()}</p>
                      <p className="text-xs" style={{ color: "rgba(26,18,11,0.45)" }}>
                        KES {milestone.funding.disbursed.toLocaleString()} disbursed
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </InfoCard>

            <InfoCard>
              <h3 className="font-display font-bold text-base text-[#1A120B] mb-4">Funding Timeline</h3>
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Calendar className="h-10 w-10" style={{ color: "rgba(201,146,42,0.3)" }} />
                <p className="text-sm text-center" style={{ color: "rgba(26,18,11,0.4)" }}>
                  Funding timeline visualization will be displayed here
                </p>
              </div>
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <InfoCard>
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <TrendingUp className="h-10 w-10" style={{ color: "rgba(201,146,42,0.3)" }} />
              <h3 className="font-display font-bold text-lg text-[#1A120B]">Reports Coming Soon</h3>
              <p className="text-sm text-center max-w-sm" style={{ color: "rgba(26,18,11,0.45)" }}>
                Detailed project analytics and reports will be available here.
              </p>
            </div>
          </InfoCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
