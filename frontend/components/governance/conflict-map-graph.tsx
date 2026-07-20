"use client"

/**
 * Compact "who aligned, who clashed" diagram for a Baraza deliberation's
 * conflict map. Agents sit on a ring; teal chords = shared concerns
 * (alignment), red chords = tensions. Dependency-free inline SVG (no D3) so it
 * stays light and CSP-safe. Meant to sit *inside* the review card as a visual
 * summary — not a hero. Renders nothing when there's nothing to draw.
 */

interface Coalition {
  agents?: string[]
  strength?: number
  sharedConcern?: string
}
interface Conflict {
  issue?: string
  between?: string[]
  intensity?: number
}

const TEAL = "#2A6B7C"
const RED = "#B03A1E"
const INK = "#0A1F14"

// What each council agent represents (the "lens" it argues from). Domain agents
// vary by panel (governance vs cooperative); analysts run in every panel.
export const AGENT_ROLES: Record<string, string> = {
  DAKTARI: "health & welfare",
  LINDA: "land & environment",
  TAJIRI: "economy",
  FOREMAN: "infrastructure",
  MWALIMU: "education & social",
  MKURUGENZI: "finance",
  MWANANCHI: "member equity",
  FUNDI: "execution",
  HUSTLER: "market & sales",
  SHAHIDI: "fact-checker",
  MPELELEZI: "feasibility & power",
  MHENGA: "historian",
  MJAMAA: "convener",
  KADERE: "values",
}

export const agentName = (k: string) =>
  k ? k.charAt(0).toUpperCase() + k.slice(1).toLowerCase() : k
export const agentRole = (k: string) => AGENT_ROLES[k?.toUpperCase()] ?? ""
const title = agentName
const roleOf = agentRole

// All unique agents that appear in any coalition or conflict.
function collectAgents(coalitions: Coalition[], conflicts: Conflict[]): string[] {
  const set = new Set<string>()
  coalitions.forEach((c) => (c.agents ?? []).forEach((a) => a && set.add(a)))
  conflicts.forEach((c) => (c.between ?? []).forEach((a) => a && set.add(a)))
  return [...set]
}

export function ConflictMapGraph({
  coalitions = [],
  conflicts = [],
}: {
  coalitions?: Coalition[]
  conflicts?: Conflict[]
}) {
  const agents = collectAgents(coalitions, conflicts)
  if (agents.length < 2 || (coalitions.length === 0 && conflicts.length === 0)) {
    return null
  }

  const SIZE = 300
  const cx = SIZE / 2
  const cy = SIZE / 2
  const R = 104
  const pos: Record<string, { x: number; y: number; a: number }> = {}
  agents.forEach((agent, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / agents.length
    pos[agent] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a }
  })

  // Chord bowed toward the centre (chord-diagram look).
  const chord = (p: string, q: string) => {
    const A = pos[p]
    const B = pos[q]
    if (!A || !B) return ""
    const mx = (A.x + B.x) / 2
    const my = (A.y + B.y) / 2
    const kx = mx + (cx - mx) * 0.55
    const ky = my + (cy - my) * 0.55
    return `M${A.x.toFixed(1)},${A.y.toFixed(1)} Q${kx.toFixed(1)},${ky.toFixed(1)} ${B.x.toFixed(1)},${B.y.toFixed(1)}`
  }
  // A coalition is drawn as a soft blob enclosing its members (not an O(n²) web
  // of chords). 2 members → a rounded capsule; 3+ → a smooth padded hull.
  type Pt = { x: number; y: number }
  const centroid = (ps: Pt[]): Pt => ({
    x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
    y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
  })
  const push = (p: Pt, c: Pt, pad: number): Pt => {
    const dx = p.x - c.x
    const dy = p.y - c.y
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad }
  }
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const hullPath = (raw: Pt[], pad = 15): string => {
    const c = centroid(raw)
    const ps = raw
      .map((p) => push(p, c, pad))
      .sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x))
    const start = mid(ps[ps.length - 1], ps[0])
    let d = `M${start.x.toFixed(1)},${start.y.toFixed(1)}`
    for (let i = 0; i < ps.length; i++) {
      const m = mid(ps[i], ps[(i + 1) % ps.length])
      d += ` Q${ps[i].x.toFixed(1)},${ps[i].y.toFixed(1)} ${m.x.toFixed(1)},${m.y.toFixed(1)}`
    }
    return d + "Z"
  }
  const memberPts = (c: Coalition): Pt[] =>
    (c.agents ?? []).map((a) => pos[a]).filter(Boolean) as Pt[]

  return (
    <figure className="m-0">
      <div style={{ maxWidth: 320, margin: "0 auto" }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Diagram of which council agents aligned and which clashed"
          style={{ width: "100%", height: "auto", overflow: "visible" }}
        >
          {/* coalition blobs (teal, subtle) — a soft hull/capsule enclosing each
              aligned group, instead of an O(n²) web of chords */}
          {coalitions.map((c, ci) => {
            const pts = memberPts(c)
            if (pts.length < 2) return null
            const strength = c.strength ?? 0.5
            const fillOp = 0.06 + strength * 0.1
            const label = `Aligned: ${c.sharedConcern ?? (c.agents ?? []).map(title).join(", ")}`
            if (pts.length === 2) {
              return (
                <path
                  key={`co-${ci}`}
                  d={`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`}
                  fill="none"
                  stroke={TEAL}
                  strokeWidth={24}
                  strokeOpacity={fillOp}
                  strokeLinecap="round"
                >
                  <title>{label}</title>
                </path>
              )
            }
            return (
              <path
                key={`co-${ci}`}
                d={hullPath(pts)}
                fill={TEAL}
                fillOpacity={fillOp}
                stroke={TEAL}
                strokeOpacity={0.18 + strength * 0.14}
                strokeWidth={1}
              >
                <title>{label}</title>
              </path>
            )
          })}
          {/* tension chords (red, prominent) */}
          {conflicts.map((c, i) => {
            const [p, q] = c.between ?? []
            if (!p || !q) return null
            return (
              <path
                key={`cf-${i}`}
                d={chord(p, q)}
                fill="none"
                stroke={RED}
                strokeWidth={1.4 + (c.intensity ?? 0.5) * 2.4}
                strokeOpacity={0.5 + (c.intensity ?? 0.5) * 0.4}
                strokeLinecap="round"
              >
                <title>{`Tension: ${c.issue ?? `${title(p)} vs ${title(q)}`}`}</title>
              </path>
            )
          })}
          {/* agent nodes + labels */}
          {agents.map((agent) => {
            const P = pos[agent]
            const c = Math.cos(P.a)
            const s = Math.sin(P.a)
            const anchor = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle"
            return (
              <g key={agent}>
                <circle cx={P.x} cy={P.y} r={5} fill={INK}>
                  <title>{roleOf(agent) ? `${title(agent)} — ${roleOf(agent)}` : title(agent)}</title>
                </circle>
                <text
                  x={P.x + c * 13}
                  y={P.y + s * 13}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  style={{ fontSize: 12, fontWeight: 600, fill: INK }}
                >
                  {title(agent)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {/* line legend */}
      <div
        className="mt-1 flex items-center justify-center gap-4 text-[11px]"
        style={{ color: "rgba(14,31,20,0.6)" }}
      >
        <span className="inline-flex items-center gap-1">
          <span style={{ width: 14, height: 3, background: RED, borderRadius: 2 }} /> tension
        </span>
        <span className="inline-flex items-center gap-1">
          <span style={{ width: 14, height: 3, background: TEAL, borderRadius: 2 }} /> alignment
        </span>
      </div>
      {/* who's who — what each agent on this council represents */}
      <figcaption className="mt-3">
        <div
          className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
          style={{ color: "rgba(14,31,20,0.5)" }}
        >
          Who's on the council
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          {agents.map((agent) => (
            <div key={agent} className="flex items-baseline gap-1.5 min-w-0">
              <span
                aria-hidden
                className="shrink-0 rounded-full"
                style={{ width: 5, height: 5, background: INK, transform: "translateY(-1px)" }}
              />
              <dt className="font-semibold shrink-0" style={{ color: INK }}>
                {title(agent)}
              </dt>
              {roleOf(agent) && (
                <dd className="m-0 truncate" style={{ color: "rgba(14,31,20,0.6)" }}>
                  {roleOf(agent)}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </figcaption>
    </figure>
  )
}
