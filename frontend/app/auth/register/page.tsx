import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"
import { ArrowLeft } from "lucide-react"

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl mx-auto mb-4"
              style={{
                background: "linear-gradient(135deg, #C9922A 0%, #E8B84B 100%)",
                color: "#0E0B08",
              }}
            >
              UJ
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Join UjamaaDAO</h1>
            <p className="text-sm text-slate-500 mt-1">
              Create your account in 4 quick steps
            </p>
          </div>

          <RegisterForm />

          <p className="text-center text-xs text-slate-400 mt-6">
            Already have an account?{" "}
            <Link href="/" className="text-orange-600 font-medium hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
