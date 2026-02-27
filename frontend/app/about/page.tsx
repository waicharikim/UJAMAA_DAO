import Link from "next/link"
import { ArrowLeft, ArrowRight, Coins, Users, Vote, ShieldCheck } from "lucide-react"

// ── Nguzo Saba ─────────────────────────────────────────────────────────────────

const NGUZO_SABA = [
  { swahili: "Umoja",        english: "Unity",                       meaning: "Strive for and maintain unity in the family, community, nation, and race." },
  { swahili: "Kujichagulia", english: "Self-Determination",          meaning: "Define ourselves, name ourselves, create for ourselves, and speak for ourselves." },
  { swahili: "Ujima",        english: "Collective Work & Responsibility", meaning: "Build and maintain our community together and make our brother's and sister's problems our problems." },
  { swahili: "Ujamaa",       english: "Cooperative Economics",       meaning: "Build and maintain our own stores, shops and businesses and profit from them together." },
  { swahili: "Nia",          english: "Purpose",                     meaning: "Make our collective vocation the building and developing of our community." },
  { swahili: "Kuumba",       english: "Creativity",                  meaning: "Do always as much as we can, in the way we can, in order to leave our community more beautiful." },
  { swahili: "Imani",        english: "Faith",                       meaning: "Believe with all our heart in our people, our parents, our teachers, our leaders, and the righteousness of our struggle." },
]

// ── Philosophy pillars ─────────────────────────────────────────────────────────

const PILLARS = [
  {
    label: "Govern Together",
    icon: Vote,
    description: "Every member earns Participation Rights through contribution — not wealth. Governance is weighted by civic work, not token holdings.",
  },
  {
    label: "Work Together",
    icon: Users,
    description: "Skills, labour, and goods flow through a community marketplace — discovery-first, trust-based, anchored in verified identity.",
  },
  {
    label: "Prosper Together",
    icon: Coins,
    description: "Community treasury managed on-chain, funded by dues, and unlocked by collective decision — every shilling traceable to outcomes.",
  },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0A1F14", color: "#F7F2E8" }}>

      {/* ── Nav back ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: "rgba(247,242,232,0.45)" }}
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>
      </div>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-20">
        <p className="mb-4 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(212,145,30,0.7)" }}>
          About UjamaaDAO
        </p>

        <h1
          className="font-serif text-5xl md:text-7xl font-bold leading-tight mb-6"
          style={{ color: "#F7F2E8" }}
        >
          The word that changed<br className="hidden md:block" /> how Africa thinks about{" "}
          <span style={{ color: "#D4911E" }}>building together.</span>
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed" style={{ color: "rgba(247,242,232,0.65)" }}>
          <em>Ujamaa</em> — Swahili for familyhood, cooperative economics, shared prosperity.
          Julius Nyerere named his governing philosophy after it in 1967. We named our protocol after
          what that philosophy was always trying to become.
        </p>
      </section>

      {/* ── Amber rule ───────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px" style={{ background: "rgba(212,145,30,0.25)" }} />
      </div>

      {/* ── What Ujamaa means ────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(212,145,30,0.7)" }}>
              The Philosophy
            </p>
            <h2 className="font-serif text-4xl font-bold mb-6" style={{ color: "#F7F2E8" }}>
              Africa has always known how to build together.
            </h2>
            <div className="space-y-4 text-base leading-relaxed" style={{ color: "rgba(247,242,232,0.65)" }}>
              <p>
                Before there were apps, there were <em>chama</em> — rotating savings groups in Kenya where
                neighbours pooled money and took turns investing. Before there were DAOs, there was{" "}
                <em>harambee</em> — the national tradition of coming together to build schools, clinics,
                roads, and futures. Before there was DeFi, there were <em>tontines</em> and <em>stokvel</em>{" "}
                networks stretching across West and Southern Africa.
              </p>
              <p>
                These systems worked not because of smart contracts, but because of trust, obligation,
                and shared stakes in each other's outcomes. UjamaaDAO is an attempt to encode that
                same logic — to make it transparent, scalable, and unforgeable.
              </p>
            </div>
          </div>

          <blockquote
            className="rounded-2xl p-8"
            style={{
              background: "rgba(247,242,232,0.04)",
              border: "1px solid rgba(212,145,30,0.22)",
            }}
          >
            <p
              className="font-serif text-xl leading-relaxed mb-6"
              style={{ color: "rgba(247,242,232,0.85)" }}
            >
              &ldquo;The foundation and the objective of African socialism is the extended family.
              The true African socialist does not look on one class of men as his brethren and
              another as his natural enemies. He regards all men as his brethren — as members,
              together, of an ever-extending family.&rdquo;
            </p>
            <footer>
              <span className="text-sm font-medium" style={{ color: "#D4911E" }}>
                Julius Nyerere
              </span>
              <br />
              <span className="text-xs" style={{ color: "rgba(247,242,232,0.4)" }}>
                Ujamaa — The Basis of African Socialism, 1962
              </span>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── Amber rule ───────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px" style={{ background: "rgba(212,145,30,0.25)" }} />
      </div>

      {/* ── Three pillars ────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-3 text-xs tracking-[0.25em] uppercase text-center" style={{ color: "rgba(212,145,30,0.7)" }}>
          What We&apos;re Building
        </p>
        <h2 className="font-serif text-4xl font-bold text-center mb-12" style={{ color: "#F7F2E8" }}>
          A platform for cooperative ownership.
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon
            return (
              <div
                key={pillar.label}
                className="rounded-2xl p-7"
                style={{
                  background: "rgba(247,242,232,0.04)",
                  border: "1px solid rgba(212,145,30,0.18)",
                }}
              >
                <div
                  className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "rgba(212,145,30,0.15)" }}
                >
                  <Icon size={20} style={{ color: "#D4911E" }} />
                </div>
                <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "#F7F2E8" }}>
                  {pillar.label}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(247,242,232,0.55)" }}>
                  {pillar.description}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Amber rule ───────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px" style={{ background: "rgba(212,145,30,0.25)" }} />
      </div>

      {/* ── Nguzo Saba ───────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-3 text-xs tracking-[0.25em] uppercase text-center" style={{ color: "rgba(212,145,30,0.7)" }}>
          Our Foundation
        </p>
        <h2 className="font-serif text-4xl font-bold text-center mb-4" style={{ color: "#F7F2E8" }}>
          Nguzo Saba — The Seven Principles
        </h2>
        <p className="text-center mb-12 max-w-xl mx-auto text-sm" style={{ color: "rgba(247,242,232,0.45)" }}>
          Every design decision, governance rule, and economic mechanism in UjamaaDAO is tested
          against these seven principles. They are the constitution behind the code.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {NGUZO_SABA.map((principle, i) => (
            <div
              key={principle.swahili}
              className="rounded-2xl p-6"
              style={{
                background: "rgba(247,242,232,0.03)",
                border: "1px solid rgba(247,242,232,0.07)",
              }}
            >
              <div className="flex items-baseline gap-3 mb-3">
                <span
                  className="text-xs font-mono"
                  style={{ color: "rgba(212,145,30,0.5)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-serif text-lg font-bold" style={{ color: "#D4911E" }}>
                  {principle.swahili}
                </span>
              </div>
              <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "rgba(247,242,232,0.35)" }}>
                {principle.english}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(247,242,232,0.5)" }}>
                {principle.meaning}
              </p>
            </div>
          ))}

          {/* The 7th principle gets extra width on 3-col grid */}
          {/* (7 items on 3-col: 2 rows of 3 + 1 lone item — centre it) */}
        </div>
      </section>

      {/* ── Amber rule ───────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px" style={{ background: "rgba(212,145,30,0.25)" }} />
      </div>

      {/* ── Protocol brief ───────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(212,145,30,0.7)" }}>
              The Protocol
            </p>
            <h2 className="font-serif text-4xl font-bold mb-6" style={{ color: "#F7F2E8" }}>
              Rights earned through contribution, not capital.
            </h2>
            <div className="space-y-4 text-base leading-relaxed" style={{ color: "rgba(247,242,232,0.65)" }}>
              <p>
                UjamaaDAO uses a hybrid on-chain / off-chain architecture. Governance and
                economic rights live on-chain (Base L2) where they are permanent and
                unforgeable. Community coordination, communication, and discovery stay
                off-chain where they are fast and free.
              </p>
              <p>
                Participation Rights (PR) are soulbound — you earn them by contributing and
                you can&apos;t sell or transfer them. Impact Points are your reputation score.
                The Community Treasury is governed by PR holders, not token speculators.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: ShieldCheck,
                label: "Participation Rights",
                tag: "Soulbound · Non-transferable",
                desc: "Earned through verified activity. Governs your voting weight. Cannot be bought.",
              },
              {
                icon: Vote,
                label: "Impact Points",
                tag: "Reputation · Non-transferable",
                desc: "Your track record of collective contribution — visible to the community, never for sale.",
              },
              {
                icon: Coins,
                label: "Community Treasury",
                tag: "On-chain · Multi-sig",
                desc: "Funded by dues and community income. Spent only through governance proposals with quorum.",
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-4 rounded-xl p-5"
                  style={{
                    background: "rgba(247,242,232,0.04)",
                    border: "1px solid rgba(56,160,99,0.2)",
                  }}
                >
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "rgba(56,160,99,0.15)" }}
                  >
                    <Icon size={17} style={{ color: "#38A063" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm" style={{ color: "#F7F2E8" }}>
                        {item.label}
                      </span>
                      <span
                        className="text-[10px] tracking-wider uppercase rounded-full px-2 py-0.5"
                        style={{
                          color: "rgba(56,160,99,0.8)",
                          background: "rgba(56,160,99,0.12)",
                        }}
                      >
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "rgba(247,242,232,0.5)" }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div
          className="rounded-3xl p-12 text-center"
          style={{
            background: "rgba(56,160,99,0.08)",
            border: "1px solid rgba(56,160,99,0.2)",
          }}
        >
          <h2 className="font-serif text-4xl font-bold mb-4" style={{ color: "#F7F2E8" }}>
            Ready to build together?
          </h2>
          <p className="mb-8 max-w-md mx-auto text-base" style={{ color: "rgba(247,242,232,0.55)" }}>
            UjamaaDAO is for people who believe that collective ownership, transparent governance,
            and mutual obligation are still the most powerful technologies ever invented.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "#D4911E", color: "#0A1F14" }}
            >
              Join the Community
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold transition-all hover:bg-cream/10"
              style={{
                border: "1px solid rgba(247,242,232,0.25)",
                color: "rgba(247,242,232,0.75)",
              }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer rule ──────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pb-12">
        <div className="h-px mb-8" style={{ background: "rgba(212,145,30,0.15)" }} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-serif text-xl font-bold" style={{ color: "rgba(247,242,232,0.25)" }}>
            UjamaaDAO
          </span>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: "rgba(247,242,232,0.3)" }}>
            {NGUZO_SABA.map((p) => (
              <span key={p.swahili}>{p.swahili}</span>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
