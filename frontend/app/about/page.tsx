import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"

// ── About UjamaaDAO ─────────────────────────────────────────────────────────────
// This page is about *us*, in *our* context: what UjamaaDAO is, for the Kenyan
// communities that already run chamas, harambees and welfare groups. Ujamaa the
// word and Nyerere the source are roots we credit — not the subject. The landing
// page carries the product story (how it works, tokens, use-cases); this page
// carries the why.

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
          <em>Ujamaa</em> means{" "}
          <span style={{ color: "#D4911E" }}>familyhood.</span>
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed" style={{ color: "rgba(247,242,232,0.7)" }}>
          It&apos;s the name we already give — in the chama, the harambee, the welfare group — to
          people pooling what they have because they&apos;re answerable to each other. UjamaaDAO
          gives that instinct the tools it never had: a way for a community to decide together, hold
          money together, and build together, on a record no one can quietly rewrite.
        </p>
      </section>

      {/* ── Amber rule ───────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px" style={{ background: "rgba(212,145,30,0.25)" }} />
      </div>

      {/* ── You already live this ────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(212,145,30,0.7)" }}>
              You already live this
            </p>
            <h2 className="font-serif text-4xl font-bold mb-6" style={{ color: "#F7F2E8" }}>
              Cooperation isn&apos;t new here. The tools are.
            </h2>
            <div className="space-y-4 text-base leading-relaxed" style={{ color: "rgba(247,242,232,0.65)" }}>
              <p>
                Down every road in Kenya there is a group already doing this. The{" "}
                <em>chama</em> that meets on Saturdays and takes turns lifting each member.
                The <em>harambee</em> that raises a hospital bill or a school roof in an afternoon.
                The welfare group that buries its own and celebrates its own. Money pooled, risk
                shared, decisions made together — because the people are, in the fullest sense of
                the word, <em>jamaa</em>: family.
              </p>
              <p>
                None of it needed a blockchain to exist. What it has always needed is something
                harder to come by — a way to keep everyone honest without asking anyone to simply
                trust that the treasurer wrote the number down right.
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl p-8"
            style={{
              background: "rgba(247,242,232,0.04)",
              border: "1px solid rgba(212,145,30,0.22)",
            }}
          >
            <p className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: "rgba(212,145,30,0.6)" }}>
              The word
            </p>
            <div className="space-y-5">
              <div>
                <span className="font-serif text-3xl font-bold" style={{ color: "#D4911E" }}>jamaa</span>
                <p className="mt-1 text-sm" style={{ color: "rgba(247,242,232,0.55)" }}>
                  family · kin · the people you answer to
                </p>
              </div>
              <div className="h-px" style={{ background: "rgba(247,242,232,0.1)" }} />
              <div>
                <span className="font-mono text-sm" style={{ color: "rgba(247,242,232,0.5)" }}>u-</span>
                <span className="font-serif text-xl" style={{ color: "rgba(247,242,232,0.7)" }}> + jamaa</span>
                <p className="mt-1 text-sm" style={{ color: "rgba(247,242,232,0.55)" }}>
                  the prefix that turns a thing into a way of being — &ldquo;-hood&rdquo;
                </p>
              </div>
              <div className="h-px" style={{ background: "rgba(247,242,232,0.1)" }} />
              <div>
                <span className="font-serif text-3xl font-bold" style={{ color: "#F7F2E8" }}>ujamaa</span>
                <p className="mt-1 text-sm" style={{ color: "rgba(247,242,232,0.55)" }}>
                  familyhood — being one another&apos;s people, and acting like it
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Amber rule ───────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px" style={{ background: "rgba(212,145,30,0.25)" }} />
      </div>

      {/* ── Where the word gets its weight (Nyerere, one beat) ── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(212,145,30,0.7)" }}>
              Where the name comes from
            </p>
            <h2 className="font-serif text-4xl font-bold mb-6" style={{ color: "#F7F2E8" }}>
              A whole country was once built on this word.
            </h2>
            <div className="space-y-4 text-base leading-relaxed" style={{ color: "rgba(247,242,232,0.65)" }}>
              <p>
                We take the name from Julius Nyerere, who did something bold with an everyday word:
                he made <em>ujamaa</em> the founding idea of a nation. His argument was that Africa
                did not need to import socialism or manufacture an enemy class — the model was
                already here, in the extended family, where you share because the people are yours.
              </p>
              <p>
                The state programme that followed was flawed, and often forced. But the idea outlived
                the policy. We are not reviving a government plan. We are keeping the part that was
                always true — and building it the way it should have been built: by choice, from the
                ground up, one community at a time.
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
            <p className="font-serif text-xl leading-relaxed mb-6" style={{ color: "rgba(247,242,232,0.85)" }}>
              &ldquo;The foundation and the objective of African socialism is the extended family.
              The true African socialist regards all men as his brethren — as members, together,
              of an ever-extending family.&rdquo;
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

      {/* ── Why UjamaaDAO / why now ──────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(212,145,30,0.7)" }}>
              Why UjamaaDAO
            </p>
            <h2 className="font-serif text-4xl font-bold mb-6" style={{ color: "#F7F2E8" }}>
              Every chama runs on trust — until it doesn&apos;t.
            </h2>
            <div className="space-y-4 text-base leading-relaxed" style={{ color: "rgba(247,242,232,0.65)" }}>
              <p>
                The oldest weak point in cooperation is not the idea — it&apos;s the custodian. The
                treasurer holds the cashbox. The chairlady keeps the book. The harambee committee
                counts the money out of sight. It works right up until it doesn&apos;t: a figure that
                doesn&apos;t add up, a contribution nobody can prove, a group that quietly falls apart
                over who was owed what.
              </p>
              <p>
                UjamaaDAO moves the trust off the person and onto the record. The community holds its
                own funds together, every decision is a binding vote, and the ledger of who gave,
                who decided, and where it went can&apos;t be edited after the fact — not by a
                chairman, not by us. The obligations of family, kept by a record that never forgets.
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl p-8"
            style={{
              background: "rgba(56,160,99,0.08)",
              border: "1px solid rgba(56,160,99,0.2)",
            }}
          >
            <p className="font-mono text-xs tracking-widest uppercase mb-5" style={{ color: "rgba(56,160,99,0.75)" }}>
              What changes
            </p>
            <div className="space-y-5 text-sm leading-relaxed">
              <div>
                <p className="font-medium mb-1" style={{ color: "#F7F2E8" }}>The old way — trust the person</p>
                <p style={{ color: "rgba(247,242,232,0.5)" }}>
                  The cashbox, the book, the committee. Everyone hopes the custodian does right, and
                  the group breaks when that hope does.
                </p>
              </div>
              <div className="h-px" style={{ background: "rgba(56,160,99,0.18)" }} />
              <div>
                <p className="font-medium mb-1" style={{ color: "#F7F2E8" }}>The new way — trust the record</p>
                <p style={{ color: "rgba(247,242,232,0.5)" }}>
                  Funds the community controls together, votes that bind, and a ledger no single
                  person — including us — can rewrite.
                </p>
              </div>
              <div className="h-px" style={{ background: "rgba(56,160,99,0.18)" }} />
              <div>
                <p className="font-medium mb-1" style={{ color: "#F7F2E8" }}>Always — real money, real rails</p>
                <p style={{ color: "rgba(247,242,232,0.5)" }}>
                  Contributions move on M-Pesa to accounts the community controls — never
                  person-to-person, never out of sight.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-4">
        <div
          className="rounded-3xl p-12 text-center"
          style={{
            background: "rgba(56,160,99,0.08)",
            border: "1px solid rgba(56,160,99,0.2)",
          }}
        >
          <h2 className="font-serif text-4xl font-bold mb-4" style={{ color: "#F7F2E8" }}>
            Bring the people you already organise with.
          </h2>
          <p className="mb-8 max-w-md mx-auto text-base" style={{ color: "rgba(247,242,232,0.55)" }}>
            You don&apos;t need to be convinced that a community can build together — you already
            know it. UjamaaDAO just gives your community a record worth trusting.
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
          <span className="text-xs tracking-widest uppercase" style={{ color: "rgba(247,242,232,0.3)" }}>
            Umoja ni nguvu — unity is strength
          </span>
        </div>
      </div>

    </div>
  )
}
