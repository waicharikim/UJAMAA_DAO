"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import {
  Menu,
  X,
  ShieldCheck,
  TrendingUp,
  Vote,
  Droplets,
  Landmark,
  Wrench,
  Mail,
  Loader2,
  ExternalLink,
} from "lucide-react"

// ── Sign-in modal ─────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === "development"

function SignInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { requestMagicLink } = useAuth()
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    if (!email.trim()) return
    setSending(true)
    try {
      await requestMagicLink({ email: email.trim() })
      setSent(true)
    } catch {
      // toast already shown inside requestMagicLink
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => { setSent(false); setEmail("") }, 300)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-chai/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{ background: "#142F22", border: "1px solid rgba(212,145,30,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-cream/40 hover:text-cream transition-colors"
          style={{ background: "rgba(247,242,232,0.06)" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <span className="font-serif text-xl font-bold text-cream">Sign in</span>
          <p className="mt-1 text-sm text-cream/50">
            Enter your email and we&apos;ll send a secure, passwordless login link.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">📬</div>
            <p className="font-medium text-cream">Check your email</p>
            <p className="text-sm text-cream/50">
              We sent a link to{" "}
              <strong className="text-amber-bright">{email}</strong>. Click it to sign in.
            </p>
            {IS_DEV && (
              <a
                href="http://localhost:8025"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber/70 hover:text-amber transition-colors"
              >
                <ExternalLink size={12} />
                Dev mode — view in MailHog
              </a>
            )}
            <button
              onClick={() => setSent(false)}
              className="block mx-auto text-sm text-cream/40 hover:text-cream/70 transition-colors mt-2"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30"
              />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                autoFocus
                className="w-full rounded-xl pl-9 pr-4 py-3 text-sm text-cream placeholder-cream/30 outline-none transition-all focus:border-amber/40"
                style={{
                  background: "rgba(247,242,232,0.07)",
                  border: "1px solid rgba(247,242,232,0.12)",
                }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !email.trim()}
              className="w-full rounded-full py-3 text-sm font-bold text-tea-dark transition-all hover:bg-amber-bright hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              style={{ background: "#D4911E" }}
            >
              {sending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Login Link"
              )}
            </button>

            <p className="text-center text-xs text-cream/30">
              New to UjamaaDAO?{" "}
              <Link
                href="/auth/register"
                onClick={handleClose}
                className="text-amber hover:text-amber-bright font-medium transition-colors"
              >
                Create your account →
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Animated concentric rings (canvas) ───────────────────────────────────────

function ConcentricRings() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let animId: number
    let dpr = 1

    const rings = [
      { r: 70,  color: "rgba(212,145,30,0.30)",  width: 1.5, speed:  0.0004,  dots: 3 },
      { r: 130, color: "rgba(56,160,99,0.22)",   width: 1.2, speed: -0.00025, dots: 4 },
      { r: 200, color: "rgba(212,145,30,0.15)",  width: 1,   speed:  0.0002,  dots: 2 },
      { r: 280, color: "rgba(247,242,232,0.08)", width: 0.8, speed: -0.00012, dots: 3 },
    ]

    const dotColors = ["#E9A52E", "#38A063", "#D4911E", "#C43D28"]

    function resize() {
      if (!canvas) return
      dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    let time = 0

    function draw() {
      if (!canvas || !ctx) return
      const w  = canvas.width  / dpr
      const h  = canvas.height / dpr
      const cx = w / 2
      const cy = h / 2

      ctx.clearRect(0, 0, w, h)
      time += 1

      for (const ring of rings) {
        ctx.beginPath()
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2)
        ctx.strokeStyle = ring.color
        ctx.lineWidth   = ring.width
        ctx.stroke()

        for (let d = 0; d < ring.dots; d++) {
          const angle = time * ring.speed + (d * Math.PI * 2) / ring.dots
          const dx    = cx + Math.cos(angle) * ring.r
          const dy    = cy + Math.sin(angle) * ring.r
          const dc    = dotColors[(d + rings.indexOf(ring)) % dotColors.length]

          ctx.beginPath()
          ctx.arc(dx, dy, 10, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, 10)
          grad.addColorStop(0, dc + "60")
          grad.addColorStop(1, dc + "00")
          ctx.fillStyle = grad
          ctx.fill()

          ctx.beginPath()
          ctx.arc(dx, dy, 3, 0, Math.PI * 2)
          ctx.fillStyle = dc
          ctx.fill()
        }
      }

      // Centre amber dot
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fillStyle = "#E9A52E"
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, 16, 0, Math.PI * 2)
      const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16)
      cGrad.addColorStop(0, "rgba(233,165,46,0.40)")
      cGrad.addColorStop(1, "rgba(233,165,46,0)")
      ctx.fillStyle = cGrad
      ctx.fill()

      animId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Use Cases",    href: "#use-cases"    },
  { label: "Principles",   href: "#principles"   },
]

function LandingNavbar({
  isAuthenticated,
  onSignIn,
}: {
  isAuthenticated: boolean
  onSignIn: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b border-cream/[0.08] bg-tea-dark/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="font-serif text-xl font-bold text-cream">
            UjamaaDAO
          </span>
          <span className="hidden rounded-full bg-amber/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-amber-bright sm:inline-block">
            protocol
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-cream/60 transition-colors hover:text-cream"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-4 md:flex">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-amber px-5 py-2 text-[13px] font-bold text-tea-dark transition-all hover:bg-amber-bright hover:scale-[1.03] active:scale-[0.97]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <button
                onClick={onSignIn}
                className="text-[13px] font-medium text-cream/60 transition-colors hover:text-cream"
              >
                Sign In
              </button>
              <Link
                href="/auth/register"
                className="rounded-full bg-amber px-5 py-2 text-[13px] font-bold text-tea-dark transition-all hover:bg-amber-bright hover:scale-[1.03] active:scale-[0.97]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-cream/70 transition-colors hover:text-cream md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-t border-cream/[0.06] bg-tea-dark/95 backdrop-blur-xl transition-all duration-300 md:hidden",
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-1 px-5 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-cream/60 transition-colors hover:text-cream"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-cream/[0.08] pt-4">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-amber px-4 py-2.5 text-center text-sm font-bold text-tea-dark"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <button
                  onClick={() => { setOpen(false); onSignIn() }}
                  className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-cream/60 hover:text-cream"
                >
                  Sign In
                </button>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-amber px-4 py-2.5 text-center text-sm font-bold text-tea-dark"
                  onClick={() => setOpen(false)}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────

function HeroSection({
  isAuthenticated,
  onSignIn,
}: {
  isAuthenticated: boolean
  onSignIn: () => void
}) {
  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-tea-dark">
      {/* Faint grid */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(247,242,232,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(247,242,232,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <ConcentricRings />

      {/* Warm radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(212,145,30,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pt-28 pb-20 lg:px-8">
        {/* Overline badge */}
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber/30 bg-amber/10 px-5 py-2">
          <div className="h-2 w-2 rounded-full bg-amber-bright" />
          <span className="text-xs font-bold uppercase tracking-[2.5px] text-amber-bright">
            {"The People's Protocol"}
          </span>
        </div>

        {/* Headline */}
        <h1 className="max-w-5xl text-center font-serif text-[clamp(2.8rem,8vw,7rem)] font-bold leading-[0.92] tracking-tight text-cream">
          Collective{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-amber-bright">Power</span>
            <span
              className="absolute -bottom-2 left-0 h-3 w-full rounded-sm"
              style={{
                background: "linear-gradient(to right, rgba(233,165,46,0.35), rgba(56,160,99,0.20))",
              }}
              aria-hidden="true"
            />
          </span>
          <br />
          <span className="text-cream">Onchain</span>
        </h1>

        <p className="mt-8 max-w-lg text-center text-lg leading-relaxed text-cream/70 lg:text-xl">
          Cooperative funding, collective governance, and community-powered economics — built for Africa.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-full bg-amber px-8 text-sm font-bold text-tea-dark shadow-[0_0_20px_rgba(212,145,30,0.30)] transition-all hover:bg-amber-bright hover:shadow-[0_0_32px_rgba(233,165,46,0.40)] hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="relative z-10">Go to Dashboard</span>
              <svg
                className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/register"
                className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-full bg-amber px-8 text-sm font-bold text-tea-dark shadow-[0_0_20px_rgba(212,145,30,0.30)] transition-all hover:bg-amber-bright hover:shadow-[0_0_32px_rgba(233,165,46,0.40)] hover:scale-[1.03] active:scale-[0.98]"
              >
                <span className="relative z-10">Join the Movement</span>
                <svg
                  className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <button
                onClick={onSignIn}
                className="inline-flex h-12 items-center rounded-full border border-cream/20 px-8 text-sm font-semibold text-cream/80 transition-colors hover:border-amber/40 hover:text-amber"
              >
                Sign In
              </button>
            </>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          {[
            { value: "47",     label: "Wards Active",  color: "#E9A52E" },
            { value: "12.4M",  label: "KES Pooled",    color: "#38A063" },
            { value: "2,400+", label: "Proposals",     color: "#C43D28" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="font-mono text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-cream/40">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom marquee strip */}
      <div className="relative z-10 overflow-hidden border-t border-cream/[0.08] py-4" aria-hidden="true">
        <div
          className="flex w-max gap-16"
          style={{ animation: "marquee 30s linear infinite" }}
        >
          {[
            "Umoja", "Ujima", "Ujamaa", "Kujichagulia", "Nia",
            "Umoja", "Ujima", "Ujamaa", "Kujichagulia", "Nia",
          ].map((word, i) => (
            <span
              key={i}
              className="whitespace-nowrap font-serif text-sm italic text-cream/20"
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── How It Works ──────────────────────────────────────────────────────────────

const steps = [
  {
    num: "01",
    icon: ShieldCheck,
    title: "Verify",
    subtitle: "Community-backed identity",
    description:
      "M-Pesa verification and community vouching. No bots, just real people with real stake.",
    color: "#C8851A",
  },
  {
    num: "02",
    icon: TrendingUp,
    title: "Contribute",
    subtitle: "Earn participation rights",
    description:
      "Funding, labor, mentorship, skills. Every contribution grows your voice in the collective.",
    color: "#2E7D4F",
  },
  {
    num: "03",
    icon: Vote,
    title: "Govern",
    subtitle: "Direct onchain democracy",
    description:
      "Proposals, transparent treasury, ward-level voting. Your community, your decisions.",
    color: "#A83220",
  },
]

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-cream py-24 lg:py-32"
    >
      {/* Subtle top accent line */}
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 h-px"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(200,133,26,0.4), rgba(46,125,79,0.25), transparent)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-xl">
          <span className="text-[11px] font-semibold uppercase tracking-[3px] text-amber">
            How It Works
          </span>
          <h2 className="mt-4 font-serif text-4xl font-bold text-chai md:text-5xl">
            Three steps to
            <br />
            collective power
          </h2>
        </div>

        {/* Steps with connecting line */}
        <div className="relative mt-20">
          <div
            className="absolute top-0 bottom-0 left-8 hidden w-px md:block"
            aria-hidden="true"
            style={{
              background:
                "linear-gradient(to bottom, rgba(200,133,26,0.35), rgba(46,125,79,0.25), rgba(168,50,32,0.20), transparent)",
            }}
          />

          <div className="flex flex-col gap-16 md:gap-20">
            {steps.map((step) => (
              <div
                key={step.num}
                className="group relative flex flex-col gap-6 md:flex-row md:items-start md:gap-16"
              >
                <div className="relative flex shrink-0 items-center gap-4 md:w-16 md:flex-col md:items-center md:gap-2">
                  <div
                    className="hidden h-3 w-3 rounded-full md:block"
                    style={{
                      backgroundColor: step.color,
                      boxShadow: `0 0 12px ${step.color}40`,
                    }}
                  />
                  <span
                    className="font-mono text-sm font-bold md:text-xs"
                    style={{ color: step.color }}
                  >
                    {step.num}
                  </span>
                </div>

                <div className="flex-1 border-l border-chai/[0.08] pl-6 md:border-l-0 md:border-t md:border-chai/[0.06] md:pt-6 md:pl-0">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${step.color}12`,
                        color: step.color,
                      }}
                    >
                      <step.icon size={22} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-chai md:text-3xl">
                        {step.title}
                      </h3>
                      <p className="mt-0.5 text-sm font-medium text-warm-gray">
                        {step.subtitle}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-chai/50">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Use Cases / Wards section ─────────────────────────────────────────────────

const showcases = [
  {
    icon: Droplets,
    title: "Fund Infrastructure",
    label: "Community Treasury",
    description:
      "Pool resources to fund boreholes, clinics, solar grids. Track every shilling from contribution to completion with onchain transparency.",
    metric: "KES 12.4M",
    metricLabel: "pooled across 47 wards",
    accent: "#C8851A",
    span: "md:col-span-2",
  },
  {
    icon: Landmark,
    title: "Govern Collectively",
    label: "Direct Democracy",
    description:
      "Every verified member gets a voice. Propose spending, debate priorities, vote on budgets. No middlemen.",
    metric: "2,400+",
    metricLabel: "proposals passed",
    accent: "#2E7D4F",
    span: "md:col-span-1",
  },
  {
    icon: Wrench,
    title: "Trade Skills Locally",
    label: "Skills Marketplace",
    description:
      "Connect plumbers, tutors, welders, nurses. Hire hyperlocal, keep money circulating within the community.",
    metric: "860",
    metricLabel: "skills listed",
    accent: "#A83220",
    span: "md:col-span-1",
  },
]

function UseCaseCard({ item }: { item: (typeof showcases)[number] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 transition-all duration-300 lg:p-8 ${item.span}`}
      style={{
        borderColor: hovered ? `${item.accent}40` : "rgba(247,242,232,0.06)",
        backgroundColor: hovered ? `${item.accent}08` : "rgba(20,47,34,0.6)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div>
        <div className="flex items-center justify-between">
          <span
            className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[1.5px]"
            style={{ borderColor: `${item.accent}25`, color: item.accent }}
          >
            {item.label}
          </span>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
            style={{ backgroundColor: `${item.accent}12`, color: item.accent }}
          >
            <item.icon size={20} strokeWidth={1.5} />
          </div>
        </div>

        <h3 className="mt-6 font-serif text-2xl font-bold text-cream lg:text-3xl">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-cream/40">
          {item.description}
        </p>
      </div>

      <div
        className="mt-8 border-t pt-5"
        style={{ borderColor: `${item.accent}12` }}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: item.accent }}>
            {item.metric}
          </span>
          <span className="text-xs text-cream/30">{item.metricLabel}</span>
        </div>
      </div>
    </div>
  )
}

function WardsSection() {
  return (
    <section
      id="use-cases"
      className="relative overflow-hidden bg-tea-green py-24 lg:py-32"
    >
      {/* Accent line */}
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 h-px"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(200,133,26,0.3), rgba(46,125,79,0.2), transparent)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="flex flex-col items-end text-right">
          <span className="text-[11px] font-semibold uppercase tracking-[3px] text-leaf">
            Use Cases
          </span>
          <h2 className="mt-4 max-w-lg font-serif text-4xl font-bold text-cream md:text-5xl">
            What communities
            <br />
            are building
          </h2>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {showcases.map((item) => (
            <UseCaseCard key={item.title} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

const footerLinks = [
  { label: "How It Works", href: "#how-it-works"  },
  { label: "Use Cases",    href: "#use-cases"      },
  { label: "About",        href: "/about"          },
  { label: "Get Started",  href: "/auth/register"  },
]

function Footer() {
  return (
    <footer
      id="principles"
      className="relative overflow-hidden border-t border-cream/[0.04] bg-tea-green"
    >
      {/* Oversized watermark */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 select-none"
        aria-hidden="true"
      >
        <span className="whitespace-nowrap font-serif text-[clamp(6rem,18vw,16rem)] font-bold leading-none text-cream/[0.02]">
          UjamaaDAO
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <span className="font-serif text-2xl font-bold text-cream">UjamaaDAO</span>
            <p className="mt-3 text-sm leading-relaxed text-cream/30">
              {"The People's Protocol. Cooperative funding, collective governance, and community-powered economics built for Africa."}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-cream/30 transition-colors hover:text-cream"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-cream/[0.04] pt-6 md:flex-row">
          <div className="flex flex-wrap gap-3">
            {["Umoja", "Ujima", "Ujamaa", "Kujichagulia", "Nia"].map((principle, i) => {
              const colors = ["#C8851A", "#2E7D4F", "#A83220"]
              const c = colors[i % colors.length]
              return (
                <span
                  key={principle}
                  className="text-[11px] font-medium"
                  style={{ color: `${c}70` }}
                >
                  {principle}
                </span>
              )
            })}
          </div>

          <p className="text-xs text-cream/20">
            {new Date().getFullYear()} UjamaaDAO
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function LandingPage() {
  const { isAuthenticated } = useAuth()
  const [signInOpen, setSignInOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      <LandingNavbar isAuthenticated={isAuthenticated} onSignIn={() => setSignInOpen(true)} />
      <HeroSection isAuthenticated={isAuthenticated} onSignIn={() => setSignInOpen(true)} />
      <HowItWorksSection />
      <WardsSection />
      <Footer />
    </div>
  )
}
