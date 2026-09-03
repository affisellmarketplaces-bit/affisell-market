export default function PayoutMethodsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100/80 dark:bg-zinc-800/60" />
      ))}
    </div>
  )
}
