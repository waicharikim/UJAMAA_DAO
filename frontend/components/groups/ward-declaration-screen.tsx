"use client"

import { useQuery } from "@tanstack/react-query"
import { communityApi } from "@/lib/api"

interface WardDeclarationScreenProps {
  groupId: string
  wardName: string
  onContinue: () => void
}

export function WardDeclarationScreen({
  groupId,
  wardName,
  onContinue,
}: WardDeclarationScreenProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["ward-declaration", groupId],
    queryFn: () => communityApi.getDeclaration(groupId),
    staleTime: Infinity,
  })

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E0B08]">
        <div className="w-6 h-6 border-2 border-[#C9922A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const paragraphs = data.declarationText.split("\n\n")
  const lastPara = paragraphs[paragraphs.length - 1]
  const bodyParas = paragraphs.slice(0, -1)

  return (
    <div className="fixed inset-0 z-50 bg-[#0E0B08] overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          {/* Amber rule above */}
          <div className="w-12 h-0.5 bg-[#C9922A] mb-10" />

          {/* Ward name header */}
          <h1
            className="text-3xl md:text-4xl font-bold mb-10 tracking-tight"
            style={{ color: "#C9922A", fontFamily: "Georgia, serif" }}
          >
            {wardName}
          </h1>

          {/* Declaration body */}
          <div className="space-y-5">
            {bodyParas.map((para, i) => {
              // Detect the Ujamaa stanza (short, poetic lines)
              const isStanza =
                para.includes("Familyhood") || para.includes("Ujamaa")
              return (
                <p
                  key={i}
                  className={`leading-relaxed ${
                    isStanza
                      ? "text-[#C9922A] text-base font-medium italic"
                      : "text-[#F7F2E8]/80 text-base"
                  }`}
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {para}
                </p>
              )
            })}
          </div>

          {/* Amber rule below */}
          <div className="w-full h-px bg-[#C9922A]/30 mt-10 mb-6" />

          {/* Colophon — ward · date · short ID */}
          <p
            className="text-[#C9922A]/60 text-sm tracking-widest uppercase"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {lastPara}
          </p>

          {/* Footer actions */}
          <div className="mt-12 flex justify-end">
            <button
              onClick={onContinue}
              className="text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              style={{ background: "#C9922A", color: "#0E0B08" }}
            >
              Enter your group →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
