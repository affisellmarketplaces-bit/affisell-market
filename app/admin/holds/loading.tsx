export default function AdminHoldsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <div className="mb-8 h-9 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-8 gap-2 border-b border-border bg-muted/40 px-4 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, row) => (
            <div
              key={row}
              className="grid grid-cols-8 gap-2 px-4 py-4"
            >
              {Array.from({ length: 8 }).map((_, col) => (
                <div
                  key={col}
                  className="h-4 animate-pulse rounded bg-muted/80"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 h-9 w-56 animate-pulse rounded-lg bg-muted" />
    </main>
  )
}
