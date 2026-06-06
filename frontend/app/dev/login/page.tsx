"use client"

import { useState } from "react"

// ─── Test account catalogue ───────────────────────────────
const TEST_ACCOUNTS = [
  // ── Simulation (Kayole) — the living ecosystem from simulate.ts ──
  {
    email: "sim.njeri@kayole.test",
    name: "Mama Njeri Kamau",
    role: "Sim · SACCO Leader",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "sim.david@kayole.test",
    name: "David Otieno",
    role: "Sim · Ward Admin",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "sim.joseph@kayole.test",
    name: "Joseph Kiprono",
    role: "Sim · proposer / project owner",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "sim.faith@kayole.test",
    name: "Faith Achieng",
    role: "Sim · member / candidate / voter",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
  {
    email: "sim.brian@kayole.test",
    name: "Brian Kemboi",
    role: "Sim · member",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
  {
    email: "sim.sharon@kayole.test",
    name: "Sharon Wangari",
    role: "Sim · mid-funnel",
    level: "PHONE_VERIFIED",
    levelColor: "#7A4F1E",
  },
  {
    email: "sim.cynthia@kayole.test",
    name: "Cynthia Akinyi",
    role: "Sim · new arrival",
    level: "EMAIL_VERIFIED",
    levelColor: "#B03A1E",
  },
  {
    email: "admin@ujamaa.test",
    name: "System Administrator",
    role: "Super Admin",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "auditor@ujamaa.test",
    name: "System Auditor",
    role: "Auditor",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "support@ujamaa.test",
    name: "Support Staff",
    role: "Support",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "compliance@ujamaa.test",
    name: "Compliance Officer",
    role: "Compliance Officer",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "coordinator@ujamaa.test",
    name: "County Coordinator",
    role: "County Coordinator",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "ward.admin@ujamaa.test",
    name: "Ward Administrator",
    role: "Ward Admin",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "waichari@ujamaa.test",
    name: "James Waichari",
    role: "Group Leader",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
  {
    email: "akinyi@ujamaa.test",
    name: "Grace Akinyi",
    role: "Member",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
  {
    email: "otieno@ujamaa.test",
    name: "Kevin Otieno",
    role: "Member",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
  {
    email: "full-member@ujamaa.test",
    name: "Wanjiru Full-Member",
    role: "Wallet Connected",
    level: "FULL_VERIFIED",
    levelColor: "#1D4731",
  },
  {
    email: "phone-only@ujamaa.test",
    name: "Amina Phone-Only",
    role: "—",
    level: "PHONE_VERIFIED",
    levelColor: "#7A4F1E",
  },
  {
    email: "email-only@ujamaa.test",
    name: "Brian Email-Only",
    role: "—",
    level: "EMAIL_VERIFIED",
    levelColor: "#B03A1E",
  },
  {
    email: "ward2.member@ujamaa.test",
    name: "Ward 2 Member",
    role: "Different Ward",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
  {
    email: "const.member@ujamaa.test",
    name: "Constituency Member",
    role: "Different Constituency",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
  {
    email: "county.member@ujamaa.test",
    name: "County Member",
    role: "Different County",
    level: "COMMUNITY_VERIFIED",
    levelColor: "#2A5240",
  },
]

export default function DevLoginPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastLogin, setLastLogin] = useState<string | null>(null)

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Not available in production.</p>
      </div>
    )
  }

  async function loginAs(email: string) {
    setLoading(email)
    setError(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
      const res = await fetch(`${apiUrl}/auth/dev/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.error?.message ?? "Login failed")

      localStorage.setItem("access_token", body.data.accessToken)
      localStorage.removeItem("refresh_token")
      setLastLogin(email)

      // Hard reload so AuthContext re-hydrates from storage
      window.location.href = "/dashboard"
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#F7F2E8" }}
    >
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{ background: "rgba(201,146,42,0.15)", color: "#C9922A" }}
          >
            ⚠ DEV ONLY — NOT IN PRODUCTION
          </div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-display, serif)", color: "#0E0B08" }}
          >
            Account Switcher
          </h1>
          <p className="text-sm" style={{ color: "rgba(14,11,8,0.5)" }}>
            Click any account to instantly log in. The top rows are the Kayole simulation cast; below are the original test users.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        {lastLogin && (
          <div className="mb-4 p-3 rounded-xl text-sm text-green-700 bg-green-50 border border-green-200">
            Logged in as {lastLogin} — redirecting…
          </div>
        )}

        {/* Account list */}
        <div className="space-y-2">
          {TEST_ACCOUNTS.map((account) => (
            <div
              key={account.email}
              className="flex items-center justify-between p-4 rounded-xl bg-white"
              style={{ border: "1px solid #E8E0D4" }}
            >
              <div className="flex-1 min-w-0 mr-3">
                <p
                  className="font-semibold text-sm truncate"
                  style={{ color: "#0E0B08" }}
                >
                  {account.name}
                </p>
                <p className="text-xs truncate" style={{ color: "rgba(14,11,8,0.45)" }}>
                  {account.email}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: `${account.levelColor}18`,
                      color: account.levelColor,
                    }}
                  >
                    {account.level}
                  </span>
                  {account.role !== "—" && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
                    >
                      {account.role}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => loginAs(account.email)}
                disabled={loading !== null}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0 transition-opacity disabled:opacity-40"
                style={{ background: "#1D4731", color: "#fff" }}
              >
                {loading === account.email ? "…" : "Login →"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(14,11,8,0.3)" }}>
          All users are in the same ward and can vouch for each other.
        </p>
      </div>
    </div>
  )
}
