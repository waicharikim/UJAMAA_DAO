"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConnectWallet } from "@/components/auth/connect-wallet"
import { useAuth } from "@/contexts/auth-context"
import {
  Users,
  Vote,
  Coins,
  Shield,
  Award,
  ArrowRight,
  Star,
  TreePine,
  Target,
  ChevronRight,
  Heart,
  Menu,
  X,
} from "lucide-react"

// ── Data ─────────────────────────────────────────────────

const features = [
  {
    icon: Vote,
    title: "Democratic Governance",
    subtitle: "Transparent Decision Making",
    description:
      "Participate in transparent, blockchain-based voting and proposal systems that embody the spirit of community cooperation.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Users,
    title: "Community Groups",
    subtitle: "Ubuntu Networks",
    description:
      "Join location-based groups that reflect our diverse African communities, fostering Ubuntu and collective growth.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Coins,
    title: "Shared Economy",
    subtitle: "Community Tokens",
    description:
      "Earn and spend community tokens through meaningful contributions, building wealth together as one people.",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: Award,
    title: "Impact Recognition",
    subtitle: "Contribution Rewards",
    description:
      "Get recognised for positive community impact with our point system that celebrates African values of giving back.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Shield,
    title: "Digital Security",
    subtitle: "Blockchain Protection",
    description:
      "Built on secure blockchain technology that protects our community's interests and maintains transparency.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: TreePine,
    title: "Environmental Focus",
    subtitle: "Sustainable Development",
    description: "Support eco-friendly projects that protect our beautiful African landscape for future generations.",
    color: "from-green-600 to-teal-500",
  },
]

const stats = [
  { label: "Active Members", value: "2,847", icon: Users },
  { label: "Proposals", value: "156", icon: Vote },
  { label: "Projects", value: "89", icon: Target },
  { label: "Tokens Distributed", value: "1.2M", icon: Coins },
]

const testimonials = [
  {
    name: "Amina Wanjiku",
    role: "Community Leader",
    location: "Nairobi, Kenya",
    content:
      "UJAMAA has transformed how our community makes decisions. The transparency and inclusivity reflect our true African values.",
    avatar: "AW",
  },
  {
    name: "Kwame Asante",
    role: "Social Entrepreneur",
    location: "Accra, Ghana",
    content:
      "Through UJAMAA, I've connected with like-minded individuals across Africa. Together, we're building something beautiful.",
    avatar: "KA",
  },
  {
    name: "Fatima Diallo",
    role: "Teacher & Activist",
    location: "Lagos, Nigeria",
    content:
      "The impact point system motivates me to contribute more to my community. It's like digital community building!",
    avatar: "FD",
  },
]

const coreValues = [
  {
    icon: Heart,
    title: "Ubuntu",
    description: "I am because we are — our interconnectedness defines us",
    color: "from-red-500 to-pink-500",
  },
  {
    icon: Users,
    title: "Harambee",
    description: "Pulling together — collective effort for community progress",
    color: "from-orange-500 to-yellow-500",
  },
  {
    icon: TreePine,
    title: "Sustainability",
    description: "Environmental stewardship — caring for our shared home",
    color: "from-green-500 to-emerald-500",
  },
]

// ── Navbar ────────────────────────────────────────────────

const ADINKRA_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='rgba(201,146,42,0.06)' stroke-width='1'%3E%3Ccircle cx='40' cy='40' r='28'/%3E%3Ccircle cx='40' cy='40' r='16'/%3E%3Cline x1='40' y1='12' x2='40' y2='0'/%3E%3Cline x1='40' y1='68' x2='40' y2='80'/%3E%3Cline x1='12' y1='40' x2='0' y2='40'/%3E%3Cline x1='68' y1='40' x2='80' y2='40'/%3E%3C/g%3E%3C/svg%3E")`

function LandingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={[
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-[#0E0B08]/95 backdrop-blur-md border-b border-[rgba(201,146,42,0.15)] shadow-lg shadow-black/20"
          : "bg-[#0E0B08]",
      ].join(" ")}
      style={{ backgroundImage: ADINKRA_BG, backgroundSize: "80px 80px" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)",
              color: "#0E0B08",
              boxShadow: "0 2px 12px rgba(201,146,42,0.35)",
            }}
          >
            UJ
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-white text-[17px]">UjamaaDAO</span>
            <span className="text-[8px] font-medium uppercase tracking-[1.5px]" style={{ color: "rgba(201,146,42,0.65)" }}>
              Ward Platform
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {[
            { label: "About", href: "/about" },
            { label: "Features", href: "#features" },
            { label: "Community", href: "#values" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[rgba(255,255,255,0.6)] hover:text-[#E8B84B] transition-colors font-medium"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button
                size="sm"
                className="text-[#0E0B08] font-semibold"
                style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
              >
                Go to Dashboard
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <ConnectWallet />
              <Link href="/auth/register">
                <Button
                  size="sm"
                  className="text-[#0E0B08] font-semibold"
                  style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
                >
                  Join Community
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-1"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-[rgba(201,146,42,0.12)] bg-[#0E0B08] px-4 pb-4 pt-2 space-y-3">
          {[
            { label: "About", href: "/about" },
            { label: "Features", href: "#features" },
            { label: "Community", href: "#values" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block text-sm text-[rgba(255,255,255,0.7)] hover:text-[#E8B84B] py-1.5 font-medium"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="w-full" size="sm">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/register">
                  <Button
                    className="w-full text-[#0E0B08] font-semibold"
                    size="sm"
                    style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
                  >
                    Join Community
                  </Button>
                </Link>
                <ConnectWallet />
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

// ── Main page ─────────────────────────────────────────────

export function LandingPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      <LandingNav isAuthenticated={isAuthenticated} />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0E0B08 0%, #1C1409 45%, #2A1F0E 70%, #1C2E1A 100%)",
          backgroundImage: ADINKRA_BG,
          backgroundSize: "80px 80px",
        }}
      >
        {/* Radial gold glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% -10%, rgba(201,146,42,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Green glow bottom-right */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 40% 40% at 90% 100%, rgba(30,100,50,0.25) 0%, transparent 60%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <Badge
            className="mb-6 border-0 text-xs font-medium px-4 py-1.5 uppercase tracking-widest"
            style={{ background: "rgba(201,146,42,0.15)", color: "#E8B84B" }}
          >
            African Digital Community DAO
          </Badge>

          <h1 className="font-display font-bold text-white mb-4" style={{ fontSize: "clamp(3rem, 10vw, 6rem)", lineHeight: 1.05 }}>
            UJAMAA
          </h1>

          <p className="text-lg md:text-xl font-medium mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>
            Decentralised Community Governance for Africa
          </p>

          <p className="text-base max-w-2xl mx-auto mb-10" style={{ color: "rgba(255,255,255,0.45)" }}>
            A DAO that brings African communities together through blockchain technology,
            embodying the spirit of Ubuntu: <em className="not-italic" style={{ color: "rgba(201,146,42,0.8)" }}>"I am because we are"</em>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-16">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="px-8 font-semibold text-[#0E0B08]"
                  style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/register">
                  <Button
                    size="lg"
                    className="px-8 font-semibold text-[#0E0B08]"
                    style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
                  >
                    Join the Community
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button
                    variant="outline"
                    size="lg"
                    className="px-8 font-medium border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white bg-transparent"
                  >
                    Learn More
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((stat, i) => {
              const Icon = stat.icon
              return (
                <div
                  key={i}
                  className="rounded-xl px-4 py-4 text-center"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(201,146,42,0.12)",
                  }}
                >
                  <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: "#E8B84B" }} />
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Core Values ─────────────────────────────────── */}
      <section id="values" className="py-20 bg-gradient-to-br from-green-50 to-yellow-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900">Our Foundation</h2>
            <p className="text-lg text-slate-500">
              Built on African values that have guided communities for generations
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {coreValues.map((value, i) => {
              const Icon = value.icon
              return (
                <div
                  key={i}
                  className="rounded-2xl p-8 text-center bg-white shadow-sm hover:shadow-md transition-shadow border border-slate-100"
                >
                  <div
                    className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${value.color} flex items-center justify-center mx-auto mb-5`}
                  >
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900">{value.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{value.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900">Powerful Features</h2>
            <p className="text-lg text-slate-500">Everything you need to participate in community governance</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={i}
                  className="group rounded-2xl p-6 border border-slate-100 hover:border-orange-200 hover:shadow-lg transition-all duration-300 bg-white"
                >
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-0.5">{feature.title}</h3>
                  <p className="text-xs font-semibold text-orange-500 mb-2">{feature.subtitle}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-orange-50 to-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900">How It Works</h2>
            <p className="text-lg text-slate-500">Three steps to join your community</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Create Your Account",
                description: "Sign up with your email, name, and select the ward you live in — takes under 2 minutes",
                icon: Users,
              },
              {
                step: "02",
                title: "Join a Group",
                description: "Find and join your local ward group or a community initiative you care about",
                icon: Users,
              },
              {
                step: "03",
                title: "Participate & Vote",
                description: "Engage in governance, vote on proposals, and earn Participation Rights",
                icon: Vote,
              },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="text-center relative">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-5"
                    style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)", color: "#0E0B08" }}
                  >
                    {item.step}
                  </div>
                  <Icon className="h-7 w-7 text-orange-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-2 text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-7 left-full w-full">
                      <ArrowRight className="h-5 w-5 text-orange-300 mx-auto" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900">Community Voices</h2>
            <p className="text-lg text-slate-500">Hear from active members across Africa</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 border border-slate-100 bg-gradient-to-br from-orange-50/50 to-white"
              >
                <div className="flex items-center mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm mr-3 flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)", color: "#0E0B08" }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                    <div className="text-xs text-orange-600 font-medium">{t.role}</div>
                    <div className="text-xs text-slate-400">{t.location}</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 italic leading-relaxed">"{t.content}"</p>
                <div className="flex text-yellow-400 mt-3 gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Footer ───────────────────────────────────── */}
      <section
        className="py-20 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0E0B08 0%, #1C2E1A 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: ADINKRA_BG,
            backgroundSize: "80px 80px",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(201,146,42,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Join UJAMAA Today</h2>
          <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
            Be part of Africa's digital transformation. Together we build stronger,
            more connected communities — one ward at a time.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="px-8 font-semibold text-[#0E0B08]"
                  style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/register">
                  <Button
                    size="lg"
                    className="px-8 font-semibold text-[#0E0B08]"
                    style={{ background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)" }}
                  >
                    Create Your Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button
                    variant="outline"
                    size="lg"
                    className="px-8 border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white bg-transparent"
                  >
                    Read More
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          <p className="mt-10 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            "Unity is strength, division is weakness" — African Proverb
          </p>
        </div>
      </section>
    </div>
  )
}
