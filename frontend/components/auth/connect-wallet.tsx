"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, LogOut, User, Loader2, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"

const IS_DEV = process.env.NODE_ENV === "development"

export function ConnectWallet() {
  const { user, isAuthenticated, isLoading, requestMagicLink, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSendLink = async () => {
    if (!email.trim()) return
    setSending(true)
    try {
      await requestMagicLink({ email: email.trim() })
      setSent(true)
    } catch {
      // toast shown inside requestMagicLink
    } finally {
      setSending(false)
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  if (isLoading) {
    return (
      <Button disabled variant="outline">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    )
  }

  if (isAuthenticated && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar || "/placeholder.svg"} />
              <AvatarFallback>{(user.username || user.email || "U")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user.username || user.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center cursor-pointer">
              <User className="h-4 w-4 mr-2" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSent(false); setEmail("") } }}>
      <DialogTrigger asChild>
        <Button>
          <Mail className="h-4 w-4 mr-2" />
          Sign In
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to UjamaaDAO</DialogTitle>
          <DialogDescription>
            Enter your email and we&apos;ll send a secure, passwordless login link.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="py-4 text-center space-y-2">
            <div className="text-4xl">📬</div>
            <p className="font-medium">Check your email</p>
            <p className="text-sm text-slate-600">
              We sent a login link to <strong>{email}</strong>. Click it to sign in.
            </p>
            {IS_DEV && (
              <a
                href="http://localhost:8025"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline mt-1"
              >
                <ExternalLink className="h-3 w-3" />
                Dev mode — view email in MailHog (localhost:8025)
              </a>
            )}
            <Button variant="outline" className="mt-2" onClick={() => setSent(false)}>
              Try a different email
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
              disabled={sending}
              autoFocus
            />
            <Button className="w-full" onClick={handleSendLink} disabled={sending || !email.trim()}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Login Link
                </>
              )}
            </Button>
            <p className="text-center text-xs text-slate-500">
              New to UjamaaDAO?{" "}
              <Link
                href="/auth/register"
                className="text-orange-600 font-medium hover:underline"
                onClick={() => setOpen(false)}
              >
                Create your account →
              </Link>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
