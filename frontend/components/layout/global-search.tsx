"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search, X, User, FileText, BookOpen, Users } from "lucide-react"
import { searchApi, type SearchResultDto } from "@/lib/api"

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

interface ResultRowProps {
  icon: React.ElementType
  label: string
  sub?: string
  onClick: () => void
}
function ResultRow({ icon: Icon, label, sub, onClick }: ResultRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[#F0EAD6] transition-colors group"
    >
      <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-[#1D4731]/10">
        <Icon className="h-3.5 w-3.5 text-[#1D4731]" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-[#1A120B] truncate">{label}</span>
        {sub && <span className="block text-[11px] text-[#7A6652] truncate">{sub}</span>}
      </span>
    </button>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 pt-2 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6652]">{title}</span>
    </div>
  )
}

function hasResults(data?: SearchResultDto) {
  if (!data) return false
  return (
    data.users.length > 0 ||
    data.proposals.length > 0 ||
    data.modules.length > 0 ||
    data.groups.length > 0
  )
}

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  const { data, isFetching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchApi.search(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 15_000,
  })

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery("")
      router.push(href)
    },
    [router]
  )

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xs">
      {/* Input */}
      <div
        className="flex items-center gap-2 h-8 px-3 rounded-full border transition-all"
        style={{
          background: "rgba(26,18,11,0.04)",
          borderColor: open ? "#C9922A" : "rgba(26,18,11,0.10)",
        }}
      >
        <Search className="h-3.5 w-3.5 text-[#7A6652] flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="flex-1 text-[13px] bg-transparent outline-none text-[#1A120B] placeholder:text-[#7A6652]/60 min-w-0"
          aria-label="Global search"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {query ? (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus() }}
            className="flex-shrink-0 text-[#7A6652] hover:text-[#1A120B]"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <span className="text-[10px] text-[#7A6652]/50 flex-shrink-0 hidden sm:block">⌘K</span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl border shadow-xl overflow-hidden"
          style={{
            background: "#FEFCF8",
            borderColor: "rgba(26,18,11,0.10)",
            minWidth: "280px",
            maxHeight: "420px",
            overflowY: "auto",
          }}
        >
          {isFetching && !data && (
            <div className="px-3 py-4 text-center text-[12px] text-[#7A6652]">Searching…</div>
          )}

          {!isFetching && data && !hasResults(data) && (
            <div className="px-3 py-4 text-center text-[12px] text-[#7A6652]">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {data && data.users.length > 0 && (
            <div>
              <SectionHeader title="Members" />
              {data.users.map((u) => (
                <ResultRow
                  key={u.id}
                  icon={User}
                  label={u.name}
                  sub={u.verificationLevel}
                  onClick={() => navigate(`/profile/${u.id}`)}
                />
              ))}
            </div>
          )}

          {data && data.proposals.length > 0 && (
            <div>
              <SectionHeader title="Proposals" />
              {data.proposals.map((p) => (
                <ResultRow
                  key={p.id}
                  icon={FileText}
                  label={p.title}
                  sub={`${p.status} · ${p.proposalType}`}
                  onClick={() => navigate(`/proposals/${p.id}`)}
                />
              ))}
            </div>
          )}

          {data && data.modules.length > 0 && (
            <div>
              <SectionHeader title="Education" />
              {data.modules.map((m) => (
                <ResultRow
                  key={m.id}
                  icon={BookOpen}
                  label={m.title}
                  sub={`${m.category} · ${m.difficulty}`}
                  onClick={() => navigate(`/education/${m.id}`)}
                />
              ))}
            </div>
          )}

          {data && data.groups.length > 0 && (
            <div className="pb-1">
              <SectionHeader title="Groups" />
              {data.groups.map((g) => (
                <ResultRow
                  key={g.id}
                  icon={Users}
                  label={g.name}
                  sub={`${g.memberCount} members · ${g.locationScope}`}
                  onClick={() => navigate(`/groups/${g.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
