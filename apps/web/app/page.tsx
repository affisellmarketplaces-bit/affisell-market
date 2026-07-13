import Link from "next/link"

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Affisell Market Intelli</h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Market intelligence multi-marketplaces: détecter les produits à lancer, où, et quand.
          TikTok OAuth est P0 (compte dev en attente).
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950"
          >
            Open dashboard
          </Link>
          <Link
            href="/connect"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium"
          >
            Connect TikTok Shop
          </Link>
        </div>
      </div>
    </div>
  )
}

