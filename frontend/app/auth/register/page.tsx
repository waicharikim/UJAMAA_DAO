import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"
import { ArrowLeft } from "lucide-react"

export default function RegisterPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "#142F22" }}
    >
      {/* Faint grid */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(247,242,232,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(247,242,232,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative w-full max-w-lg">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-cream/40 hover:text-cream/70 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "#F7F2E8",
            border: "1px solid rgba(212,145,30,0.15)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          }}
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-xl mx-auto mb-4"
              style={{
                background: "linear-gradient(135deg, #D4911E 0%, #E9A52E 100%)",
                color: "#142F22",
                boxShadow: "0 4px 16px rgba(212,145,30,0.35)",
              }}
            >
              UJ
            </div>
            <h1 className="text-2xl font-serif font-bold text-chai">Join UjamaaDAO</h1>
            <p className="text-sm text-warm-gray mt-1">
              Create your account in 4 quick steps
            </p>
          </div>

          <RegisterForm />

          <p className="text-center text-xs text-warm-gray mt-6">
            Already have an account?{" "}
            <Link href="/" className="text-amber font-medium hover:text-amber-bright transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
