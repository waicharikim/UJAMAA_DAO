export default function ProposalsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="h-16 rounded-2xl bg-[#EDE7DA]" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-2xl bg-[#EDE7DA]" />
        <div className="h-24 rounded-2xl bg-[#EDE7DA]" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-[#EDE7DA]" />
        ))}
      </div>
    </div>
  )
}
