"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { governanceApi, type ProposalAnnotationDto } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { ThumbsUp, ThumbsDown, Trash2, MessageSquare } from "lucide-react"

interface AnnotationSidebarProps {
  annotations: ProposalAnnotationDto[]
  proposalId: string
  currentUserId: string | null
  canReact: boolean
  onDeleted: (annotationId: string) => void
  onReacted: (annotationId: string, upvotes: number, downvotes: number, myReaction: "UP" | "DOWN" | null) => void
}

const FIELD_LABELS: Record<string, string> = {
  description: "Proposal Description",
  rationale: "Why This Approach",
  alternatives: "Alternatives Considered",
}

export function AnnotationSidebar({
  annotations,
  proposalId,
  currentUserId,
  canReact,
  onDeleted,
  onReacted,
}: AnnotationSidebarProps) {
  const { toast } = useToast()
  const [localAnnotations, setLocalAnnotations] = useState(annotations)

  // Keep local state in sync with parent
  if (localAnnotations !== annotations) setLocalAnnotations(annotations)

  const { mutate: deleteAnnotation } = useMutation({
    mutationFn: (annotationId: string) =>
      governanceApi.deleteAnnotation(proposalId, annotationId),
    onSuccess: (_, annotationId) => {
      onDeleted(annotationId)
      toast({ title: "Annotation removed" })
    },
  })

  const { mutate: react } = useMutation({
    mutationFn: ({ annotationId, type }: { annotationId: string; type: "UP" | "DOWN" | null }) =>
      governanceApi.reactToAnnotation(proposalId, annotationId, type),
    onSuccess: (result, { annotationId }) => {
      onReacted(annotationId, result.upvotes, result.downvotes, result.myReaction)
    },
    onError: () => toast({ title: "Failed to react", variant: "destructive" }),
  })

  if (!annotations.length) return null

  const grouped = annotations.reduce<Record<string, ProposalAnnotationDto[]>>((acc, ann) => {
    if (!acc[ann.fieldKey]) acc[ann.fieldKey] = []
    acc[ann.fieldKey].push(ann)
    return acc
  }, {})

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(29,71,49,0.10)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "rgba(29,71,49,0.04)", borderBottom: "1px solid rgba(29,71,49,0.08)" }}
      >
        <MessageSquare className="h-4 w-4" style={{ color: "#C9922A" }} />
        <h3 className="text-sm font-bold" style={{ color: "#0A1F14" }}>
          Community Opinions
        </h3>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(201,146,42,0.12)", color: "#C9922A" }}
        >
          {annotations.length}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "rgba(14,11,8,0.06)" }}>
        {Object.entries(grouped).map(([fieldKey, fieldAnnotations]) => (
          <div key={fieldKey}>
            <p
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#7A6E60", background: "rgba(247,242,232,0.5)" }}
            >
              {FIELD_LABELS[fieldKey] ?? fieldKey}
            </p>
            <div className="divide-y" style={{ borderColor: "rgba(14,11,8,0.04)" }}>
              {fieldAnnotations.map((ann) => (
                <AnnotationCard
                  key={ann.id}
                  annotation={ann}
                  currentUserId={currentUserId}
                  canReact={canReact}
                  onDelete={() => deleteAnnotation(ann.id)}
                  onReact={(type) => react({ annotationId: ann.id, type })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnnotationCard({
  annotation,
  currentUserId,
  canReact,
  onDelete,
  onReact,
}: {
  annotation: ProposalAnnotationDto
  currentUserId: string | null
  canReact: boolean
  onDelete: () => void
  onReact: (type: "UP" | "DOWN" | null) => void
}) {
  return (
    <div
      className="px-4 py-3 space-y-2"
      style={{ borderLeft: `3px solid ${annotation.color}` }}
    >
      {/* Author row */}
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
          style={{ background: annotation.color }}
        >
          {(annotation.author?.name ?? "M")[0].toUpperCase()}
        </div>
        <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: "#0A1F14" }}>
          {annotation.author?.name ?? "Member"}
        </span>
        <span className="text-[10px]" style={{ color: "#7A6E60" }}>
          {new Date(annotation.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
        </span>
        {currentUserId === annotation.authorId && (
          <button onClick={onDelete} className="p-0.5 rounded" style={{ color: "#B03A1E" }}>
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Quoted text */}
      <blockquote
        className="text-[11px] px-2 py-1 rounded"
        style={{
          borderLeft: `2px solid ${annotation.color}80`,
          color: "#7A6E60",
          background: annotation.color + "0D",
        }}
      >
        "{annotation.quotedText.slice(0, 120)}{annotation.quotedText.length > 120 ? "…" : ""}"
      </blockquote>

      {/* Comment */}
      <p className="text-[12px] leading-relaxed" style={{ color: "#0A1F14" }}>
        {annotation.comment}
      </p>

      {/* Reactions */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={() => onReact(annotation.myReaction === "UP" ? null : "UP")}
          disabled={!canReact}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-40"
          style={
            annotation.myReaction === "UP"
              ? { background: annotation.color + "22", color: annotation.color }
              : { background: "rgba(14,11,8,0.05)", color: "#7A6E60" }
          }
        >
          <ThumbsUp className="h-3 w-3" />
          {annotation.upvotes}
        </button>
        <button
          onClick={() => onReact(annotation.myReaction === "DOWN" ? null : "DOWN")}
          disabled={!canReact}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-40"
          style={
            annotation.myReaction === "DOWN"
              ? { background: "#B03A1E22", color: "#B03A1E" }
              : { background: "rgba(14,11,8,0.05)", color: "#7A6E60" }
          }
        >
          <ThumbsDown className="h-3 w-3" />
          {annotation.downvotes}
        </button>
      </div>
    </div>
  )
}
