"use client"

import { useRef, useState, useMemo, useCallback, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { governanceApi, type ProposalAnnotationDto } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, ThumbsUp, ThumbsDown, Trash2, MessageSquarePlus } from "lucide-react"

interface AnnotatableTextProps {
  text: string
  fieldKey: string
  proposalId: string
  annotations: ProposalAnnotationDto[]
  currentUserId: string | null
  canAnnotate: boolean
  /** Only this annotation's span is highlighted (driven by the opinions list);
      the proposal text stays clean otherwise. */
  activeAnnotationId?: string | null
  onCreated: (annotation: ProposalAnnotationDto) => void
  onDeleted: (annotationId: string) => void
  onReacted: (annotationId: string, upvotes: number, downvotes: number, myReaction: "UP" | "DOWN" | null) => void
}

interface SelectionState {
  start: number
  end: number
  selectedText: string
}

interface DetailState {
  annotation: ProposalAnnotationDto
}

interface Segment {
  text: string
  annotation: ProposalAnnotationDto | null
  start: number
  end: number
}

function buildSegments(text: string, annotations: ProposalAnnotationDto[]): Segment[] {
  if (!annotations.length) return [{ text, annotation: null, start: 0, end: text.length }]

  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset)
  const segments: Segment[] = []
  let cursor = 0

  for (const ann of sorted) {
    const start = Math.min(ann.startOffset, text.length)
    const end = Math.min(ann.endOffset, text.length)
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), annotation: null, start: cursor, end: start })
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), annotation: ann, start, end })
    }
    cursor = Math.max(cursor, end)
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), annotation: null, start: cursor, end: text.length })
  }

  return segments
}

function getOffsetInContainer(container: HTMLElement, node: Node, nodeOffset: number): number {
  let offset = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (current === node) return offset + nodeOffset
    offset += (current.textContent?.length ?? 0)
    current = walker.nextNode()
  }
  return offset + nodeOffset
}

export function AnnotatableText({
  text,
  fieldKey,
  proposalId,
  annotations,
  currentUserId,
  canAnnotate,
  activeAnnotationId = null,
  onCreated,
  onDeleted,
  onReacted,
}: AnnotatableTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [detail, setDetail] = useState<DetailState | null>(null)
  const { toast } = useToast()

  const fieldAnnotations = useMemo(
    () => annotations.filter((a) => a.fieldKey === fieldKey),
    [annotations, fieldKey]
  )

  // Keep the proposal text clean: highlight ONLY the active annotation's span
  // (set by hovering/tapping an opinion in the list). With at most one span,
  // overlapping annotations can never garble the text.
  const activeAnn = useMemo(
    () => fieldAnnotations.find((a) => a.id === activeAnnotationId) ?? null,
    [fieldAnnotations, activeAnnotationId]
  )

  const segments = useMemo(
    () => buildSegments(text, activeAnn ? [activeAnn] : []),
    [text, activeAnn]
  )

  const { mutate: createAnnotation, isPending: creating } = useMutation({
    mutationFn: (dto: { fieldKey: string; startOffset: number; endOffset: number; quotedText: string; comment: string }) =>
      governanceApi.createAnnotation(proposalId, dto),
    onSuccess: (result) => {
      onCreated(result)
      setSelection(null)
      setCommentDraft("")
      toast({ title: "Opinion recorded" })
    },
    onError: (err: any) => {
      toast({ title: "Failed to save annotation", description: err?.message, variant: "destructive" })
    },
  })

  const { mutate: deleteAnnotation } = useMutation({
    mutationFn: (annotationId: string) =>
      governanceApi.deleteAnnotation(proposalId, annotationId),
    onSuccess: (_, annotationId) => {
      onDeleted(annotationId)
      setDetail(null)
      toast({ title: "Annotation removed" })
    },
  })

  const { mutate: react } = useMutation({
    mutationFn: ({ annotationId, type }: { annotationId: string; type: "UP" | "DOWN" | null }) =>
      governanceApi.reactToAnnotation(proposalId, annotationId, type),
    onSuccess: (result, { annotationId }) => {
      onReacted(annotationId, result.upvotes, result.downvotes, result.myReaction)
      if (detail?.annotation.id === annotationId) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                annotation: {
                  ...prev.annotation,
                  upvotes: result.upvotes,
                  downvotes: result.downvotes,
                  myReaction: result.myReaction,
                },
              }
            : null
        )
      }
    },
  })

  // Works for both mouse (desktop) and touch (mobile) via onPointerUp
  const handlePointerUp = useCallback(() => {
    if (!canAnnotate || !containerRef.current) return

    // Small delay lets the browser finalise the touch selection
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) return

      const range = sel.getRangeAt(0)
      if (!containerRef.current!.contains(range.commonAncestorContainer)) return

      const selectedText = sel.toString().trim()
      if (!selectedText) return

      const start = getOffsetInContainer(containerRef.current!, range.startContainer, range.startOffset)
      const end = getOffsetInContainer(containerRef.current!, range.endContainer, range.endOffset)
      if (end <= start) return

      setSelection({ start, end, selectedText })
      setDetail(null)
    }, 50)
  }, [canAnnotate])

  // Close selection panel on outside click/tap
  useEffect(() => {
    if (!selection) return
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-annotation-panel]") && !target.closest("[data-annotatable]")) {
        setSelection(null)
        setCommentDraft("")
      }
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [selection])

  // Close detail panel on outside click/tap
  useEffect(() => {
    if (!detail) return
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-detail-panel]")) {
        setDetail(null)
      }
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [detail])

  const handleMarkClick = useCallback(
    (ann: ProposalAnnotationDto, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation()
      setDetail({ annotation: ann })
      setSelection(null)
    },
    []
  )

  const handleSubmit = () => {
    if (!selection || !commentDraft.trim()) return
    createAnnotation({
      fieldKey,
      startOffset: selection.start,
      endOffset: selection.end,
      quotedText: selection.selectedText,
      comment: commentDraft.trim(),
    })
  }

  return (
    <div className="relative" data-annotatable>
      {/* How-it-works banner — shown before any selection */}
      {canAnnotate && !selection && !detail && (
        <div
          className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "rgba(201,146,42,0.07)", border: "1px dashed rgba(201,146,42,0.3)" }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#C9922A" }} />
          <p className="text-[11px] leading-snug" style={{ color: "#9A6B1A" }}>
            <span className="font-semibold">Have an opinion?</span>
            {" "}Highlight any part of the text below and add a comment — it's saved to
            Community Opinions. The text stays clean; hover an opinion to see what it refers to.
          </p>
        </div>
      )}

      {/* Annotatable text body */}
      <div
        ref={containerRef}
        onPointerUp={handlePointerUp}
        className="text-sm leading-relaxed whitespace-pre-line select-text"
        style={{ color: "#0A1F14", cursor: canAnnotate ? "text" : "default" }}
      >
        {segments.map((seg, i) => {
          if (!seg.annotation) {
            return <span key={i}>{seg.text}</span>
          }
          const ann = seg.annotation
          const isTextMatch = text.slice(ann.startOffset, ann.endOffset) === ann.quotedText
          if (!isTextMatch) return <span key={i}>{seg.text}</span>
          return (
            <mark
              key={i}
              onClick={(e) => handleMarkClick(ann, e)}
              onTouchEnd={(e) => { e.preventDefault(); handleMarkClick(ann, e) }}
              style={{
                background: ann.color + "30",
                borderBottom: `2px solid ${ann.color}`,
                cursor: "pointer",
                borderRadius: "2px",
                padding: "0 1px",
              }}
            >
              {seg.text}
            </mark>
          )
        })}
      </div>

      {/* Selection panel — inline below text, full-width (works on mobile) */}
      {selection && canAnnotate && (
        <div
          data-annotation-panel
          className="mt-3 rounded-xl p-3 space-y-2"
          style={{
            background: "white",
            border: "1px solid rgba(29,71,49,0.15)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold" style={{ color: "#1D4731" }}>Add your opinion</p>
            <button onClick={() => { setSelection(null); setCommentDraft("") }}>
              <X className="h-3 w-3" style={{ color: "#7A6E60" }} />
            </button>
          </div>
          <blockquote
            className="text-[11px] px-2 py-1 rounded"
            style={{ borderLeft: "3px solid #C9922A", color: "#7A6E60", background: "rgba(201,146,42,0.06)" }}
          >
            "{selection.selectedText.slice(0, 80)}{selection.selectedText.length > 80 ? "…" : ""}"
          </blockquote>
          <textarea
            autoFocus
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="What do you think about this?"
            rows={3}
            maxLength={2000}
            className="w-full text-xs rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2"
            style={{
              border: "1px solid rgba(14,11,8,0.12)",
              background: "rgba(247,242,232,0.6)",
              color: "#0A1F14",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={creating || !commentDraft.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "#1D4731", color: "white" }}
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
            </button>
            <button
              onClick={() => { setSelection(null); setCommentDraft("") }}
              className="px-3 py-2 rounded-full text-xs"
              style={{ background: "rgba(14,11,8,0.06)", color: "#7A6E60" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Detail panel — inline, full-width */}
      {detail && (
        <div
          data-detail-panel
          className="mt-3 rounded-xl p-3 space-y-2"
          style={{
            background: "white",
            border: `1px solid ${detail.annotation.color}44`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: detail.annotation.color }}
              >
                {(detail.annotation.author?.name ?? "M")[0].toUpperCase()}
              </div>
              <span className="text-[12px] font-semibold" style={{ color: "#0A1F14" }}>
                {detail.annotation.author?.name ?? "Member"}
              </span>
            </div>
            <button onClick={() => setDetail(null)}>
              <X className="h-3 w-3" style={{ color: "#7A6E60" }} />
            </button>
          </div>

          <blockquote
            className="text-[11px] px-2 py-1 rounded"
            style={{
              borderLeft: `3px solid ${detail.annotation.color}`,
              color: "#7A6E60",
              background: detail.annotation.color + "10",
            }}
          >
            "{detail.annotation.quotedText.slice(0, 100)}{detail.annotation.quotedText.length > 100 ? "…" : ""}"
          </blockquote>

          <p className="text-[12px] leading-relaxed" style={{ color: "#0A1F14" }}>
            {detail.annotation.comment}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => react({
                annotationId: detail.annotation.id,
                type: detail.annotation.myReaction === "UP" ? null : "UP",
              })}
              disabled={!canAnnotate}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-40"
              style={
                detail.annotation.myReaction === "UP"
                  ? { background: detail.annotation.color + "25", color: detail.annotation.color }
                  : { background: "rgba(14,11,8,0.05)", color: "#7A6E60" }
              }
            >
              <ThumbsUp className="h-3 w-3" />
              {detail.annotation.upvotes}
            </button>
            <button
              onClick={() => react({
                annotationId: detail.annotation.id,
                type: detail.annotation.myReaction === "DOWN" ? null : "DOWN",
              })}
              disabled={!canAnnotate}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-40"
              style={
                detail.annotation.myReaction === "DOWN"
                  ? { background: "#B03A1E22", color: "#B03A1E" }
                  : { background: "rgba(14,11,8,0.05)", color: "#7A6E60" }
              }
            >
              <ThumbsDown className="h-3 w-3" />
              {detail.annotation.downvotes}
            </button>
            <span className="ml-auto text-[10px]" style={{ color: "#7A6E60" }}>
              {new Date(detail.annotation.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
            </span>
            {currentUserId === detail.annotation.authorId && (
              <button
                onClick={() => deleteAnnotation(detail.annotation.id)}
                className="p-1 rounded"
                style={{ color: "#B03A1E" }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
