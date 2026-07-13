"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, X, Send, Sparkles } from "lucide-react"
import { integrationApi } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

const GOLD = "#C9922A"
const INK = "#0A1F14"
const TEAL = "#2A6B7C"

const GREETING =
  "Habari! I'm Buda. Ask me about your communities — proposals, elections, treasury, past decisions, or how UjamaaDAO works."

/**
 * Floating in-app Baraza assistant. Same brain as the Telegram bot, reasoning
 * over all of the signed-in member's communities. Renders nothing for
 * signed-out visitors (the endpoint requires auth). The conversation is
 * threaded server-side per user, so history survives a page reload.
 */
export function BarazaChatWidget() {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
      inputRef.current?.focus()
    }
  }, [open, turns, sending])

  if (!isAuthenticated) return null

  async function send() {
    const message = input.trim()
    if (!message || sending) return
    setInput("")
    setTurns((t) => [...t, { role: "user", content: message }])
    setSending(true)
    try {
      const { answer } = await integrationApi.askBaraza(message)
      setTurns((t) => [...t, { role: "assistant", content: answer }])
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content:
            "Something went wrong reaching the assistant. Please try again in a moment.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <>
      {/* Launcher — sits above the mobile pill nav */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Buda"
          className="fixed z-40 bottom-28 right-4 md:bottom-6 md:right-6 flex items-center justify-center h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: INK, color: "#F7F2E8" }}
        >
          <MessageCircle className="h-6 w-6" />
          <span
            className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2"
            style={{ background: GOLD, borderColor: "#F7F2E8" }}
          />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col overflow-hidden bg-white
                     inset-x-0 bottom-0 top-0
                     md:inset-auto md:bottom-6 md:right-6 md:top-auto
                     md:h-[600px] md:max-h-[80vh] md:w-[380px] md:rounded-2xl"
          style={{ boxShadow: "0 8px 40px rgba(14,11,8,0.22)" }}
          role="dialog"
          aria-label="Buda assistant"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: INK, color: "#F7F2E8" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
              <div className="leading-tight">
                <p className="text-sm font-bold">Buda</p>
                <p className="text-[11px] opacity-70">Your community assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
            style={{ background: "#F7F2E8" }}
          >
            <Bubble role="assistant" text={GREETING} />
            {turns.map((turn, i) => (
              <Bubble key={i} role={turn.role} text={turn.content} />
            ))}
            {sending && <Bubble role="assistant" text="…" typing />}
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2 border-t px-3 py-2.5" style={{ borderColor: "rgba(14,11,8,0.08)" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="Ask about your communities…"
              className="flex-1 resize-none bg-transparent text-sm outline-none max-h-28 py-1.5"
              style={{ color: INK }}
            />
            <button
              onClick={() => void send()}
              disabled={!input.trim() || sending}
              aria-label="Send"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
              style={{ background: GOLD, color: INK }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Bubble({ role, text, typing }: { role: "user" | "assistant"; text: string; typing?: boolean }) {
  const isUser = role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words"
        style={
          isUser
            ? { background: INK, color: "#F7F2E8", borderBottomRightRadius: 6 }
            : {
                background: "#fff",
                color: INK,
                borderBottomLeftRadius: 6,
                boxShadow: "0 1px 4px rgba(14,11,8,0.08)",
              }
        }
      >
        {typing ? (
          <span className="inline-flex gap-1 py-0.5" aria-label="Assistant is typing">
            <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
          </span>
        ) : (
          text
        )}
      </div>
    </div>
  )
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full animate-bounce"
      style={{ background: TEAL, animationDelay: delay }}
    />
  )
}
