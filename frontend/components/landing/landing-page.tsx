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
  Award,
  Zap,
  Coins,
  Ban,
  Users,
  Globe,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === "development"

const NGUZO_SABA = [
  "Umoja",        // Unity
  "Kujitambua", // Self-determination
  "Haki",         // Justice & Rights
  "Ujamaa",       // Cooperative economics
  "Nia",          // Purpose
  "Ubunifu",      // Creativity
  "Imani",        // Faith
]

// ── Sign-in modal ─────────────────────────────────────────────────────────────

function SignInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { requestMagicLink } = useAuth()
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const handleSend = async () => {
    if (!email.trim()) return
    setSending(true)
    setNotFound(false)
    try {
      await requestMagicLink({ email: email.trim() })
      setSent(true)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 404) setNotFound(true)
      // toast already shown inside requestMagicLink
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    onClose()
    setTimeout(() => { setSent(false); setEmail(""); setNotFound(false) }, 300)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-chai/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{ background: "#142F22", border: "1px solid rgba(212,145,30,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-lg text-cream/40 hover:text-cream transition-colors"
          style={{ background: "rgba(247,242,232,0.06)" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

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
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/30" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setNotFound(false) }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                autoFocus
                className="w-full rounded-xl pl-9 pr-4 py-3 text-sm text-cream placeholder-cream/30 outline-none transition-all focus:border-amber/40"
                style={{
                  background: "rgba(247,242,232,0.07)",
                  border: "1px solid rgba(247,242,232,0.12)",
                }}
              />
            </div>

            {notFound && (
              <p className="text-sm text-amber-bright/90 rounded-xl px-3 py-2" style={{ background: "rgba(212,145,30,0.12)", border: "1px solid rgba(212,145,30,0.25)" }}>
                No account found.{" "}
                <Link href="/auth/register" onClick={handleClose} className="font-semibold underline underline-offset-2 hover:text-amber-bright">
                  Create one here
                </Link>
              </p>
            )}

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

// ── 3D Orbital System (canvas) ────────────────────────────────────────────────
//
// Four rings represent the four governance tiers: Community → Constituency → County → National.
// Each ring is a tilted ellipse with a bright near-arc and dim far-arc for 3-D depth.
// Dots are positioned in true 3-D, depth-sorted, and rendered with scale/opacity by depth.
// Mouse parallax shifts the orbit center, reinforcing the spatial feel.

function OrbitalSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef  = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let dpr = 1

    // tilt: inclination in radians (0 = flat circle, approaching π/2 = edge-on)
    // axial: rotation of the orbit plane around the view axis
    const rings = [
      { r: 62,  tilt: 0.25, axial:  0.30, color: "#D4911E", width: 1.5, speed:  0.00070, dots: 2 },
      { r: 118, tilt: 0.52, axial: -0.40, color: "#38A063", width: 1.2, speed: -0.00045, dots: 3 },
      { r: 185, tilt: 0.38, axial:  1.10, color: "#D4911E", width: 1.0, speed:  0.00028, dots: 2 },
      { r: 265, tilt: 0.62, axial: -0.70, color: "#F7F2E8", width: 0.7, speed: -0.00018, dots: 4 },
    ] as const

    const dotPalette = ["#E9A52E", "#38A063", "#D4911E", "#C43D28", "#C8A45A"]

    function resize() {
      if (!canvas) return
      dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = {
        x: e.clientX - window.innerWidth  / 2,
        y: e.clientY - window.innerHeight / 2,
      }
    }

    let t = 0
    let lastTime = 0

    function draw(time: number = 0) {
      animId = requestAnimationFrame(draw)
      // Cap to ~30fps — halves paint work on slow devices
      if (time - lastTime < 33) return
      lastTime = time
      if (!canvas || !ctx) return
      const W = canvas.width  / dpr
      const H = canvas.height / dpr
      const cx = W / 2 + mouseRef.current.x * 0.022
      const cy = H / 2 + mouseRef.current.y * 0.018

      ctx.clearRect(0, 0, W, H)
      t += 1

      // Ring back halves — dim (far side of each orbit)
      for (const ring of rings) {
        const ry = Math.max(ring.r * Math.cos(ring.tilt), 0.5)
        ctx.save()
        ctx.globalAlpha = 0.14
        ctx.strokeStyle = ring.color
        ctx.lineWidth   = ring.width
        ctx.beginPath()
        ctx.ellipse(cx, cy, ring.r, ry, ring.axial, Math.PI, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      // Collect all dots across rings, then depth-sort
      type Dot = {
        sx: number; sy: number; lz: number
        color: string; scale: number; alpha: number
      }
      const dots: Dot[] = []

      for (let ri = 0; ri < rings.length; ri++) {
        const ring = rings[ri]
        for (let d = 0; d < ring.dots; d++) {
          const theta = t * ring.speed + (d * Math.PI * 2) / ring.dots
          // 3-D position in ring's local frame
          const lx =  ring.r * Math.cos(theta)
          const ly =  ring.r * Math.sin(theta) * Math.cos(ring.tilt)
          const lz =  ring.r * Math.sin(theta) * Math.sin(ring.tilt)
          // Axial rotation → screen coords
          const sx = cx + lx * Math.cos(ring.axial) - ly * Math.sin(ring.axial)
          const sy = cy + lx * Math.sin(ring.axial) + ly * Math.cos(ring.axial)
          // Depth [-1 far, +1 near]
          const maxZ   = ring.r * Math.sin(ring.tilt)
          const depthN = maxZ > 0.001 ? lz / maxZ : 0
          const t01    = (depthN + 1) / 2
          dots.push({
            sx, sy, lz,
            color: dotPalette[(d + ri) % dotPalette.length],
            scale: 0.55 + 0.85 * t01,
            alpha: 0.28 + 0.72 * t01,
          })
        }
      }

      dots.sort((a, b) => a.lz - b.lz)

      // Ring front halves — bright (near side)
      for (const ring of rings) {
        const ry = Math.max(ring.r * Math.cos(ring.tilt), 0.5)
        ctx.save()
        ctx.globalAlpha = 0.55
        ctx.strokeStyle = ring.color
        ctx.lineWidth   = ring.width
        ctx.beginPath()
        ctx.ellipse(cx, cy, ring.r, ry, ring.axial, 0, Math.PI)
        ctx.stroke()
        ctx.restore()
      }

      // Depth-sorted dots
      for (const dot of dots) {
        const dr = 3.5 * dot.scale
        const grad = ctx.createRadialGradient(dot.sx, dot.sy, 0, dot.sx, dot.sy, dr * 3.5)
        grad.addColorStop(0, dot.color + "50")
        grad.addColorStop(1, dot.color + "00")
        ctx.save()
        ctx.globalAlpha = dot.alpha * 0.75
        ctx.beginPath()
        ctx.arc(dot.sx, dot.sy, dr * 3.5, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.globalAlpha = dot.alpha
        ctx.beginPath()
        ctx.arc(dot.sx, dot.sy, dr, 0, Math.PI * 2)
        ctx.fillStyle = dot.color
        ctx.fill()
        ctx.restore()
      }

      // Pulsing central sun
      const pulse = 1 + 0.12 * Math.sin(t * 0.021)

      const coronaR = 50 * pulse
      const corona  = ctx.createRadialGradient(cx, cy, 0, cx, cy, coronaR)
      corona.addColorStop(0,    "rgba(233,165,46,0.24)")
      corona.addColorStop(0.35, "rgba(233,165,46,0.10)")
      corona.addColorStop(1,    "rgba(233,165,46,0)")
      ctx.beginPath()
      ctx.arc(cx, cy, coronaR, 0, Math.PI * 2)
      ctx.fillStyle = corona
      ctx.fill()

      for (let i = 0; i < 8; i++) {
        const a  = t * 0.003 + (i * Math.PI * 2) / 8
        const r1 = 7   * pulse
        const r2 = (16 + 9 * Math.sin(t * 0.018 + i * 1.2)) * pulse
        const al = 0.10 + 0.08 * Math.sin(t * 0.014 + i * 0.9)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
        ctx.strokeStyle = `rgba(233,165,46,${al.toFixed(3)})`
        ctx.lineWidth   = 1
        ctx.stroke()
      }

      const innerR = 17 * pulse
      const inner  = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR)
      inner.addColorStop(0,   "rgba(255,225,100,0.95)")
      inner.addColorStop(0.4, "rgba(233,165,46,0.50)")
      inner.addColorStop(1,   "rgba(233,165,46,0)")
      ctx.beginPath()
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
      ctx.fillStyle = inner
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, 4.5 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = "#FFF0A0"
      ctx.fill()

    }

    // Pause animation when tab is hidden — prevents Lighthouse from accumulating
    // 100s of main-thread rendering time during background audits
    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(animId)
      } else {
        lastTime = 0
        animId = requestAnimationFrame(draw)
      }
    }

    resize()
    animId = requestAnimationFrame(draw)
    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMouseMove)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("visibilitychange", onVisibilityChange)
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
  { label: "Vision",       href: "#vision"      },
  { label: "How It Works", href: "#how-it-works" },
  { label: "The Protocol", href: "#principles"   },
  { label: "About",        href: "/about"        },
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
        <Link href="/" className="flex items-center gap-2.5">
          <span className="font-serif text-xl font-bold text-cream">UjamaaDAO</span>
          <span className="hidden rounded-full bg-amber/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1.5px] text-amber-bright sm:inline-block">
            protocol
          </span>
        </Link>

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
                className="text-[13px] font-medium text-cream/70 transition-colors hover:text-cream"
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

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-cream/70 transition-colors hover:text-cream md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

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
                <Link
                  href="/auth/register"
                  className="rounded-full bg-amber px-4 py-2.5 text-center text-sm font-bold text-tea-dark"
                  onClick={() => setOpen(false)}
                >
                  Get Started
                </Link>
                <button
                  onClick={() => { onSignIn(); setOpen(false) }}
                  className="rounded-full border border-cream/20 px-4 py-2.5 text-center text-sm font-medium text-cream/80 hover:text-cream"
                >
                  Sign In
                </button>
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
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(247,242,232,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(247,242,232,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <OrbitalSystem />

      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(212,145,30,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pt-28 pb-20 lg:px-8">
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber/30 bg-amber/10 px-5 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-bright" />
          <span className="text-xs font-bold uppercase tracking-[2.5px] text-amber-bright">
            {"The People's Protocol"}
          </span>
        </div>

        <h1 className="max-w-5xl text-center font-serif text-[clamp(2.8rem,8vw,7rem)] font-bold leading-[0.92] tracking-tight text-cream">
          Cooperative{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-amber-bright">Ownership</span>
            <span
              className="absolute -bottom-2 left-0 h-3 w-full rounded-sm"
              style={{
                background: "linear-gradient(to right, rgba(233,165,46,0.35), rgba(56,160,99,0.20))",
              }}
              aria-hidden="true"
            />
          </span>
          <br />
          <span className="text-cream">for Everyone</span>
        </h1>

        <p className="mt-8 max-w-xl text-center text-lg leading-relaxed text-cream/65 lg:text-xl">
          African communities have always built together — the chama, the harambee, the sacco.
          UjamaaDAO is the infrastructure those traditions always deserved:
          transparent, programmable, and owned by the community itself.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-full bg-amber px-8 text-sm font-bold text-tea-dark shadow-[0_0_20px_rgba(212,145,30,0.30)] transition-all hover:bg-amber-bright hover:shadow-[0_0_32px_rgba(233,165,46,0.40)] hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="relative z-10">Go to Dashboard</span>
              <svg className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/register"
                className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-full bg-amber px-8 text-sm font-bold text-tea-dark shadow-[0_0_20px_rgba(212,145,30,0.30)] transition-all hover:bg-amber-bright hover:shadow-[0_0_32px_rgba(233,165,46,0.40)] hover:scale-[1.03] active:scale-[0.98]"
              >
                <span className="relative z-10">Get Started</span>
                <svg className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <button
                onClick={onSignIn}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-cream/20 bg-cream/5 px-8 text-sm font-semibold text-cream/80 backdrop-blur-sm transition-all hover:border-cream/40 hover:bg-cream/10 hover:text-cream"
              >
                Sign In
              </button>
            </>
          )}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-14">
          {[
            { value: "47",     label: "Communities Active", color: "#E9A52E" },
            { value: "12.4M",  label: "KES Pooled",         color: "#38A063" },
            { value: "2,400+", label: "Decisions Made",     color: "#C43D28" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-cream/40">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Marquee strip — all 7 Nguzo Saba */}
      <div className="relative z-10 overflow-hidden border-t border-cream/[0.08] py-4" aria-hidden="true">
        <div
          className="flex w-max gap-16"
          style={{ animation: "marquee 40s linear infinite" }}
        >
          {[...NGUZO_SABA, ...NGUZO_SABA].map((word, i) => (
            <span key={i} className="whitespace-nowrap font-serif text-sm italic text-cream/20">
              {word}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Vision / Philosophy section ───────────────────────────────────────────────

function VisionSection() {
  return (
    <section
      id="vision"
      className="relative overflow-hidden bg-tea-dark py-28 lg:py-36"
    >
      {/* Left accent line */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-px"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(212,145,30,0.30), rgba(56,160,99,0.18), transparent)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 lg:px-8">

        {/* Opening statement */}
        <div className="max-w-3xl">
          <span className="text-[11px] font-semibold uppercase tracking-[3px] text-amber">
            The Vision
          </span>
          <h2 className="mt-5 font-serif text-[clamp(2rem,5vw,3.75rem)] font-bold leading-[1.05] text-cream">
            Africa has always known
            <br />
            how to build{" "}
            <span className="text-amber-bright">together</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-cream/55">
            The chama, the harambee, the rotating savings circle, the clan cooperative —
            collective ownership is not a new idea on this continent.
            It is the oldest idea. Communities have pooled resources,
            shared risk, and governed through consensus for centuries.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-cream/55">
            What has been missing is infrastructure. Transparent ledgers. Programmable rules.
            Permanent records. A way for communities to hold funds, make decisions,
            and build wealth without trusting a single person to do the right thing.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-cream/55">
            That is what UjamaaDAO is. Not DeFi. Not crypto speculation.
            Cooperative economics — the practice of building enterprises together for
            the collective good — finally given the infrastructure it deserves.
          </p>
        </div>

        {/* Three philosophy pillars */}
        <div
          className="mt-20 grid gap-px md:grid-cols-3"
          style={{ background: "rgba(247,242,232,0.05)" }}
        >
          {[
            {
              icon: Ban,
              heading: "Not DeFi",
              body: "Decentralised finance optimises for yield and speculation. We optimise for community utility. Every mechanism is designed for people who live and work together, not traders who never meet.",
              color: "#C8851A",
            },
            {
              icon: Users,
              heading: "Not Charity",
              body: "This is not aid. It is economic self-determination. Members pool real money, make real decisions, and build real assets. Wealth stays in the community because the community owns the protocol.",
              color: "#2E7D4F",
            },
            {
              icon: Globe,
              heading: "Not Governance Theater",
              body: "Every vote executes. Every proposal that passes moves funds. Accountability is not a value statement — it is a smart contract. The ledger is public. The rules are code.",
              color: "#A83220",
            },
          ].map((pillar) => (
            <div
              key={pillar.heading}
              className="flex flex-col gap-4 bg-tea-dark/80 p-8 lg:p-10"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${pillar.color}14`, color: pillar.color }}
              >
                <pillar.icon size={22} strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-2xl font-bold text-cream">{pillar.heading}</h3>
              <p className="text-sm leading-relaxed text-cream/45">{pillar.body}</p>
            </div>
          ))}
        </div>

        {/* Manifesto quote */}
        <div className="mt-20 border-l-2 border-amber/40 pl-8 lg:pl-12">
          <blockquote className="font-serif text-2xl font-medium italic leading-relaxed text-cream/80 lg:text-3xl">
            &ldquo;Ujamaa means the extended family. It means caring for each other.
            It means building together. This is not ideology imposed from above.
            This is what African communities have always done.&rdquo;
          </blockquote>
          <p className="mt-5 text-sm font-medium text-amber/70">
            Inspired by Julius Nyerere&apos;s Arusha Declaration, 1967
          </p>
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
    subtitle: "Community-vouched identity",
    description:
      "Register with your phone number and community details. Two existing members vouch for you — replacing bureaucratic KYC with social trust. You receive a Participation Rights token, soulbound to your identity, that proves your stake in the community.",
    color: "#C8851A",
  },
  {
    num: "02",
    icon: TrendingUp,
    title: "Contribute",
    subtitle: "Build your onchain record",
    description:
      "Fund a community project. Offer your skills on the marketplace. Mentor another member. Every contribution earns Impact Points — a permanent, tamper-proof onchain record of what you have built. Your reputation compounds, year after year.",
    color: "#2E7D4F",
  },
  {
    num: "03",
    icon: Vote,
    title: "Govern",
    subtitle: "Real decisions, real consequences",
    description:
      "Raise a spending proposal. Debate with your community. Vote using your Participation Rights. Every vote that passes executes. Funds release. Work begins. No committee discretion, no chairperson veto — the community decides, the contract acts.",
    color: "#A83220",
  },
]

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-cream py-24 lg:py-32"
    >
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 h-px"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to right, transparent, rgba(200,133,26,0.4), rgba(46,125,79,0.25), transparent)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-xl">
          <span className="text-[11px] font-semibold uppercase tracking-[3px] text-amber">
            How It Works
          </span>
          <h2 className="mt-4 font-serif text-4xl font-bold text-chai md:text-5xl">
            From member to
            <br />
            co-owner
          </h2>
          <p className="mt-4 text-base text-chai/50">
            Three steps that transform a community into a self-governing, collectively owned economic institution.
          </p>
        </div>

        <div className="relative mt-20">
          <div
            className="absolute top-0 bottom-0 left-8 hidden w-px md:block"
            aria-hidden="true"
            style={{
              background: "linear-gradient(to bottom, rgba(200,133,26,0.35), rgba(46,125,79,0.25), rgba(168,50,32,0.20), transparent)",
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
                    style={{ backgroundColor: step.color, boxShadow: `0 0 12px ${step.color}40` }}
                  />
                  <span className="font-mono text-sm font-bold md:text-xs" style={{ color: step.color }}>
                    {step.num}
                  </span>
                </div>

                <div className="flex-1 border-l border-chai/[0.08] pl-6 md:border-l-0 md:border-t md:border-chai/[0.06] md:pt-6 md:pl-0">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${step.color}12`, color: step.color }}
                    >
                      <step.icon size={22} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-chai md:text-3xl">{step.title}</h3>
                      <p className="mt-0.5 text-sm font-medium text-warm-gray">{step.subtitle}</p>
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

// ── Use Cases / Community section ─────────────────────────────────────────────

const showcases = [
  {
    icon: Droplets,
    title: "Fund Community Infrastructure",
    label: "Community Treasury",
    description:
      "Pool contributions from across your community for boreholes, solar grids, clinics, or road repair. Funds release in milestone tranches verified onchain — no upfront trust required, no chairperson holding the account.",
    metric: "KES 12.4M",
    metricLabel: "pooled across active communities",
    accent: "#C8851A",
    span: "md:col-span-2",
  },
  {
    icon: Landmark,
    title: "Govern Collectively",
    label: "Direct Democracy",
    description:
      "Any verified member can raise a proposal. The community debates and votes. The treasury executes. No middleman. No committee discretion. Every decision is permanent and public.",
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
      "Connect plumbers, tutors, welders, nurses, and coders within your community. Hire hyperlocal. Keep money circulating. Build the local economy from the inside out.",
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
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${item.accent}12`, color: item.accent }}
          >
            <item.icon size={20} strokeWidth={1.5} />
          </div>
        </div>
        <h3 className="mt-6 font-serif text-2xl font-bold text-cream lg:text-3xl">{item.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-cream/45">{item.description}</p>
      </div>
      <div className="mt-8 border-t pt-5" style={{ borderColor: `${item.accent}12` }}>
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

function UseCasesSection() {
  return (
    <section
      id="use-cases"
      className="relative overflow-hidden bg-tea-green py-24 lg:py-32"
    >
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 h-px"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to right, transparent, rgba(200,133,26,0.3), rgba(46,125,79,0.2), transparent)",
        }}
      />
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="flex flex-col items-end text-right">
          <span className="text-[11px] font-semibold uppercase tracking-[3px] text-leaf">In Practice</span>
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

// ── Protocol / Economy section ────────────────────────────────────────────────

const economyPillars = [
  {
    icon: Award,
    title: "Participation Rights",
    subtitle: "Your voice, not your wallet",
    description:
      "PR tokens are soulbound — earned through community verification, never purchased or transferred. Every verified member carries the same governance weight. Rich or poor, your vote counts equally. This is the foundation of equitable governance.",
    tag: "Soulbound Token",
    accent: "#C8851A",
  },
  {
    icon: Zap,
    title: "Impact Points",
    subtitle: "Contribution leaves a permanent mark",
    description:
      "Every shilling contributed, every skill shared, every hour volunteered earns Impact Points. They compound into your onchain reputation — a tamper-proof, public record of what you have built across years and decades. It cannot be faked, bought, or deleted.",
    tag: "Non-Transferable",
    accent: "#2E7D4F",
  },
  {
    icon: Coins,
    title: "Community Treasury",
    subtitle: "Every shilling, fully accountable",
    description:
      "Community funds flow through transparent onchain wallets. No chairperson discretion, no committee gatekeeping, no bank that can freeze your account. Smart contracts hold and release on community vote — and anyone can verify every transaction, anytime.",
    tag: "Onchain Treasury",
    accent: "#A83220",
  },
]

function EconomyCard({ item }: { item: (typeof economyPillars)[number] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-chai/[0.08] bg-white/55 p-7 shadow-sm transition-shadow hover:shadow-md">
      <div
        className="pointer-events-none absolute top-0 right-0 h-28 w-28 rounded-bl-full opacity-[0.05]"
        style={{ backgroundColor: item.accent }}
        aria-hidden="true"
      />
      <div
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${item.accent}12`, color: item.accent }}
      >
        <item.icon size={22} strokeWidth={1.5} />
      </div>
      <span
        className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1.5px]"
        style={{ borderColor: `${item.accent}30`, color: item.accent }}
      >
        {item.tag}
      </span>
      <h3 className="mt-4 font-serif text-xl font-bold text-chai">{item.title}</h3>
      <p className="mt-1 text-[13px] font-medium text-warm-gray">{item.subtitle}</p>
      <p className="mt-3 text-sm leading-relaxed text-chai/55">{item.description}</p>
    </div>
  )
}

function ProtocolSection() {
  return (
    <section
      id="principles"
      className="relative overflow-hidden bg-cream py-24 lg:py-32"
    >
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 h-px"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to right, transparent, rgba(168,50,32,0.30), rgba(200,133,26,0.20), transparent)",
        }}
      />

      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-[3px] text-amber">
            The Protocol
          </span>
          <h2 className="mt-4 font-serif text-4xl font-bold text-chai md:text-5xl">
            Built for people,
            <br />
            not capital
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-chai/50">
            Every mechanism in UjamaaDAO asks the same question: does this serve the community member
            or the capital holder? When those interests conflict, the community member wins. Every time.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {economyPillars.map((pillar) => (
            <EconomyCard key={pillar.title} item={pillar} />
          ))}
        </div>

        {/* Nguzo Saba strip */}
        <div className="mt-20 border-t border-chai/[0.06] pt-10">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[3px] text-amber">
            Nguzo Saba — The Seven Principles
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {[
              { sw: "Umoja",        en: "Unity"                 },
              { sw: "Kujitambua", en: "Self-Determination"    },
              { sw: "Haki",         en: "Justice & Rights"      },
              { sw: "Ujamaa",       en: "Cooperative Economics" },
              { sw: "Nia",          en: "Purpose"               },
              { sw: "Ubunifu",      en: "Creativity"            },
              { sw: "Imani",        en: "Faith"                 },
            ].map(({ sw, en }, i) => {
              const colors = ["#C8851A", "#2E7D4F", "#A83220"]
              return (
                <div key={sw} className="flex items-baseline gap-1.5">
                  <span className="font-serif text-sm font-semibold" style={{ color: colors[i % colors.length] }}>
                    {sw}
                  </span>
                  <span className="text-xs text-chai/30">{en}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

const footerLinks = [
  { label: "Vision",       href: "#vision"        },
  { label: "How It Works", href: "#how-it-works"  },
  { label: "The Protocol", href: "#principles"    },
  { label: "About",        href: "/about"          },
  { label: "Get Started",  href: "/auth/register" },
]

function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-cream/[0.04] bg-tea-green">
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
              Cooperative economics for the digital age. Built from Africa,
              for communities that have always known how to build together.
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
            {NGUZO_SABA.map((principle, i) => {
              const colors = ["#C8851A", "#2E7D4F", "#A83220"]
              return (
                <span
                  key={principle}
                  className="text-[11px] font-medium"
                  style={{ color: `${colors[i % colors.length]}65` }}
                >
                  {principle}
                </span>
              )
            })}
          </div>
          <p className="text-xs text-cream/20">{new Date().getFullYear()} UjamaaDAO</p>
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
      <VisionSection />
      <HowItWorksSection />
      <UseCasesSection />
      <ProtocolSection />
      <Footer />
    </div>
  )
}
