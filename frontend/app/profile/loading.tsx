export default function ProfileLoading() {
  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-3xl mx-auto animate-pulse">
      <div className="h-12 w-48 rounded-xl bg-[#EDE7DA]" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-[#EDE7DA]" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-[#EDE7DA]" />
    </div>
  )
}
