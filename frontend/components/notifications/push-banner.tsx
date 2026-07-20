"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notificationsApi } from "@/lib/api"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

type PushState = "unknown" | "granted" | "denied" | "loading"

export function PushNotificationBanner() {
  const [state, setState] = useState<PushState>("unknown")
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("denied")
      return
    }
    if (Notification.permission === "granted") setState("granted")
    else if (Notification.permission === "denied") setState("denied")
    else setState("unknown")
  }, [])

  async function enable() {
    setState("loading")
    try {
      // Register SW
      const reg = await navigator.serviceWorker.register("/sw.js")

      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState("denied")
        return
      }

      // Get VAPID key
      const { publicKey } = await notificationsApi.getVapidPublicKey()

      // Subscribe to push
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = pushSub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      await notificationsApi.subscribePush({ endpoint: json.endpoint, keys: json.keys })
      setState("granted")
    } catch (err) {
      console.error("Push subscribe failed", err)
      setState("unknown")
    }
  }

  async function disable() {
    setState("loading")
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js")
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await notificationsApi.unsubscribePush(sub.endpoint)
          await sub.unsubscribe()
        }
      }
      setState("unknown")
    } catch {
      setState("granted")
    }
  }

  if (dismissed || state === "denied") return null

  if (state === "granted") {
    return (
      <div
        className="flex items-center justify-between rounded-2xl px-4 py-3"
        style={{ background: "rgba(29,71,49,0.06)", border: "1px solid rgba(29,71,49,0.12)" }}
      >
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-[#1D4731]" />
          <span className="text-[13px] font-medium text-[#1D4731]">Push notifications are on</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={disable}
            className="h-7 px-3 text-xs text-[#7A6652] hover:text-[#1A120B] rounded-full"
          >
            <BellOff className="h-3.5 w-3.5 mr-1" />
            Turn off
          </Button>
        </div>
      </div>
    )
  }

  // unknown — show enable prompt
  return (
    <div
      className="flex items-center justify-between rounded-2xl px-4 py-3"
      style={{ background: "rgba(201,146,42,0.07)", border: "1px solid rgba(201,146,42,0.18)" }}
    >
      <div className="flex items-center gap-2.5">
        <Bell className="h-4 w-4 text-[#C9922A]" />
        <div>
          <p className="text-[13px] font-semibold text-[#1A120B]">Enable push notifications</p>
          <p className="text-[11px] text-[#7A6652]">Get alerts for votes, proposals, and ward events</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={enable}
          disabled={state === "loading"}
          className="h-7 px-3 text-xs font-bold rounded-full"
          style={{ background: "#C9922A", color: "#fff" }}
        >
          {state === "loading" ? "…" : "Enable"}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 text-[#7A6652]"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
