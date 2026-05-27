"use client"

import { useRef, useState, useMemo, useCallback, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { governanceApi, type ProposalAnnotationDto } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react"

interface AnnotatableTextProps {
  text: string
  fieldKey: string
  proposalId: string
  annotations: ProposalAnnotationDto[]
  currentUserId: string | null
  canAnnotate: boolean
  onCreated: (annotation: ProposalAnnotationDto) => void
  onDeleted: (annotationId: string) => void
  onReacted: (annotationId: string, upvotes: number, downvotes: number, myReaction: "UP" | "DOWN" | null) => void
}

interface SelectionState {
  start: number
  end: number
  selectedText: string
  x: number
  y: number
}

interface DetailState {
  annotation: ProposalAnnotationDto
  x: number
  y: number
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

  const segments = useMemo(
    () => buildSegments(text, fieldAnnotations),
    [text, fieldAnnotations]
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

  const handleMouseUp = useCallback(() => {
    if (!canAnnotate || !containerRef.current) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return

    const range = sel.getRangeAt(0)
    if (!containerRef.current.contains(range.commonAncestorContainer)) return

    const selectedText = sel.toString().trim()
    if (!selectedText) return

    const start = getOffsetInContainer(containerRef.current, range.startContainer, range.startOffset)
    const end = getOffsetInContainer(containerRef.current, range.endContainer, range.endOffset)
    if (end <= start) return

    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    setSelection({
      start,
      end,
      selectedText,
      x: rect.left - containerRect.left,
      y: rect.bottom - containerRect.top + 6,
    })
    setDetail(null)
  }, [canAnnotate])

  // Close selection popover on outside click
  useEffect(() => {
    if (!selection) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-annotation-popover]") && !target.closest("[data-annotatable]")) {
        setSelection(null)
        setCommentDraft("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [selection])

  // Close detail popover on outside click
  useEffect(() => {
    if (!detail) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-detail-popover]")) {
        setDetail(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [detail])

  const handleMarkClick = useCallback(
    (ann: ProposalAnnotationDto, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const target = e.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      setDetail({
        annotation: ann,
        x: rect.left - containerRect.left,
        y: rect.bottom - containerRect.top + 6,
      })
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
      {/* Annotatable text body */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
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

      {/* Hint for annotatable fields */}
      {canAnnotate && (
        <p className="mt-1 text-[10px]" style={{ color: "#7A6E60" }}>
          Select any text above to add your opinion
        </p>
      )}

      {/* Selection popover */}
      {selection && canAnnotate && (
        <div
          data-annotation-popover
          className="absolute z-50 rounded-xl shadow-xl p-3 space-y-2"
          style={{
            top: selection.y,
            left: Math.max(0, selection.x),
            width: 280,
            background: "white",
            border: "1px solid rgba(29,71,49,0.15)",
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
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "#1D4731", color: "white" }}
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
            </button>
            <button
              onClick={() => { setSelection(null); setCommentDraft("") }}
              className="px-3 py-1.5 rounded-full text-xs"
              style={{ background: "rgba(14,11,8,0.06)", color: "#7A6E60" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Detail popover */}
      {detail && (
        <div
          data-detail-popover
          className="absolute z-50 rounded-xl shadow-xl p-3 space-y-2"
          style={{
            top: detail.y,
            left: Math.max(0, detail.x),
            width: 300,
            background: "white",
            border: `1px solid ${detail.annotation.color}44`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: detail.annotation.color }}
              />
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

          {/* Reaction buttons */}
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
