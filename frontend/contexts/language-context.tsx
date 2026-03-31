"use client"

/**
 * LanguageContext
 *
 * Provides a simple EN/SW toggle for the UjamaaDAO interface.
 * Swahili is the first language of many ward members — especially
 * in rural areas where English literacy is lower. This is not a
 * cosmetic feature: it is a participation barrier removal.
 *
 * Language preference is persisted in localStorage.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react"

export type Language = "en" | "sw"

interface LanguageContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

// ── Translation dictionary ────────────────────────────────────────────────

const TRANSLATIONS: Record<string, Record<Language, string>> = {
  // Navigation
  "nav.dashboard":   { en: "Dashboard",    sw: "Dashibodi" },
  "nav.proposals":   { en: "Proposals",    sw: "Mapendekezo" },
  "nav.governance":  { en: "Governance",   sw: "Utawala" },
  "nav.elections":   { en: "Elections",    sw: "Uchaguzi" },
  "nav.projects":    { en: "Projects",     sw: "Miradi" },
  "nav.community":   { en: "Community",    sw: "Jamii" },
  "nav.learn":       { en: "Learn",        sw: "Jifunza" },
  "nav.emergency":   { en: "Emergency",    sw: "Dharura" },
  "nav.leaderboard": { en: "Leaderboard",  sw: "Orodha ya Ubora" },
  "nav.marketplace": { en: "Marketplace",  sw: "Soko" },
  "nav.treasury":    { en: "Treasury",     sw: "Hazina" },
  "nav.conflicts":   { en: "Conflicts",    sw: "Migogoro" },
  "nav.profile":     { en: "Profile",      sw: "Wasifu" },

  // Common actions
  "action.submit":   { en: "Submit",       sw: "Wasilisha" },
  "action.cancel":   { en: "Cancel",       sw: "Ghairi" },
  "action.save":     { en: "Save",         sw: "Hifadhi" },
  "action.continue": { en: "Continue",     sw: "Endelea" },
  "action.back":     { en: "Back",         sw: "Rudi" },
  "action.join":     { en: "Join",         sw: "Jiunge" },
  "action.leave":    { en: "Leave",        sw: "Ondoka" },
  "action.vote":     { en: "Vote",         sw: "Piga kura" },
  "action.create":   { en: "Create",       sw: "Unda" },
  "action.view_all": { en: "View all",     sw: "Angalia zote" },

  // Proposal page
  "proposal.title":       { en: "Proposal Title",        sw: "Kichwa cha Pendekezo" },
  "proposal.description": { en: "Description",           sw: "Maelezo" },
  "proposal.rationale":   { en: "Why this approach",     sw: "Kwa nini njia hii" },
  "proposal.alternatives":{ en: "Alternatives considered",sw: "Njia mbadala zilizofikiwa" },
  "proposal.outcome":     { en: "Real-world outcome",    sw: "Matokeo halisi" },
  "proposal.vote_yes":    { en: "Yes",                   sw: "Ndio" },
  "proposal.vote_no":     { en: "No",                    sw: "Hapana" },
  "proposal.vote_abstain":{ en: "Abstain",               sw: "Jiepushe" },
  "proposal.rejected":    { en: "This proposal was rejected",   sw: "Pendekezo hili lilikataliwa" },
  "proposal.what_next":   { en: "Here are your options:", sw: "Hizi ndizo chaguo zako:" },
  "proposal.revise":      { en: "Revise and resubmit",   sw: "Rekebisha na wasilisha tena" },

  // Groups
  "group.create":     { en: "Create a Group",    sw: "Unda Kikundi" },
  "group.join":       { en: "Join Group",        sw: "Jiunge na Kikundi" },
  "group.leave":      { en: "Leave Group",       sw: "Acha Kikundi" },
  "group.members":    { en: "Members",           sw: "Wanachama" },
  "group.created":    { en: "Created",           sw: "Iliundwa" },

  // Economy
  "economy.pr_balance":      { en: "Participation Rights", sw: "Haki za Kushiriki" },
  "economy.withdraw":        { en: "Withdraw",              sw: "Toa pesa" },
  "economy.dues":            { en: "Contributions",         sw: "Michango" },

  // Ward Declaration
  "declaration.view": { en: "View founding declaration", sw: "Angalia tamko la uanzishaji" },
  "declaration.continue": { en: "I understand — take me to the platform", sw: "Ninaelewa — nipeleke kwenye jukwaa" },

  // Feed
  "feed.title":        { en: "Community Feed",    sw: "Habari za Jamii" },
  "feed.empty":        { en: "No activity yet — be the first to create a proposal!", sw: "Hakuna shughuli bado — kuwa wa kwanza kuunda pendekezo!" },
  "feed.load_more":    { en: "Load more",          sw: "Pakia zaidi" },
  "feed.new_activity": { en: "New activity — tap to refresh", sw: "Shughuli mpya — gusa kusasisha" },

  // Status
  "status.voting":       { en: "Voting Open",      sw: "Kupiga kura kumefunguliwa" },
  "status.approved":     { en: "Approved",         sw: "Imeidhinishwa" },
  "status.rejected":     { en: "Rejected",         sw: "Imekataliwa" },
  "status.completed":    { en: "Completed",        sw: "Imekamilika" },
  "status.draft":        { en: "Draft",            sw: "Rasimu" },
  "status.pending":      { en: "Under Review",     sw: "Inachunguzwa" },

  // Governance page
  "governance.title":      { en: "Platform Governance",    sw: "Utawala wa Jukwaa" },
  "governance.subtitle":   { en: "How UjamaaDAO governs itself", sw: "Jinsi UjamaaDAO inavyojisimamia" },
  "governance.statement":  {
    en: "Every community-wide decision is made here, in public, by members.",
    sw: "Kila uamuzi wa jamii unafanywa hapa, hadharani, na wanachama.",
  },
}

// ── Context ───────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en")

  useEffect(() => {
    const stored = localStorage.getItem("ujamaa_lang") as Language | null
    if (stored === "en" || stored === "sw") {
      setLangState(stored)
    }
  }, [])

  function setLang(next: Language) {
    setLangState(next)
    localStorage.setItem("ujamaa_lang", next)
  }

  function t(key: string): string {
    return TRANSLATIONS[key]?.[lang] ?? TRANSLATIONS[key]?.en ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
