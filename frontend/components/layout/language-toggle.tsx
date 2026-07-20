"use client"

import { useLanguage } from "@/contexts/language-context"

export function LanguageToggle() {
  const { lang, setLang } = useLanguage()

  return (
    <div
      className="flex items-center rounded-full overflow-hidden text-[11px] font-bold"
      style={{ border: "1px solid rgba(201,146,42,0.25)" }}
    >
      <button
        onClick={() => setLang("en")}
        className="px-3 py-1 transition-colors"
        style={
          lang === "en"
            ? { background: "#C9922A", color: "#0E0B08" }
            : { color: "#C9922A", background: "transparent" }
        }
      >
        EN
      </button>
      <button
        onClick={() => setLang("sw")}
        className="px-3 py-1 transition-colors"
        style={
          lang === "sw"
            ? { background: "#C9922A", color: "#0E0B08" }
            : { color: "#C9922A", background: "transparent" }
        }
      >
        SW
      </button>
    </div>
  )
}
