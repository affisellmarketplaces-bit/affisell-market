export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-sm text-zinc-300">World map heatmap</div>
          <div className="mt-3 text-xs text-zinc-500">
            Placeholder V1 — affichera le score cross-market et les pays chauds.
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-sm text-zinc-300">Top 10 produits cross-market</div>
          <div className="mt-3 text-xs text-zinc-500">
            Placeholder V1 — alimenté par ProductSnapshot + ScoringModule.
          </div>
        </div>
      </div>
    </div>
  )
}

