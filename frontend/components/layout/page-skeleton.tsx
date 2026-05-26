export function PageSkeleton({ rows = 3, cards = false }: { rows?: number; cards?: boolean }) {
  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-5 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-[#EDE7DA]" />
      {cards ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-[#EDE7DA]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-10 rounded-xl bg-[#EDE7DA]" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-[#EDE7DA]" />
          ))}
        </div>
      )}
    </div>
  )
}
