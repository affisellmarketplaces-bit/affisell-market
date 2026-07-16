import Link from "next/link"

import type { RadarPlan } from "@/lib/radar/plans"

export default function RadarPaywallPanel({
  plan,
  title,
  reason,
  children,
}: {
  plan: RadarPlan
  title: string
  reason: string
  children?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
      {children && (
        <div className="pointer-events-none select-none blur-sm opacity-60" aria-hidden>
          {children}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 p-6">
        <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-6 text-center shadow-xl">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-300">
            Plan {plan.name}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-zinc-300">{reason}</p>
          <Link
            href="/pricing?feature=radar"
            className="mt-5 inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            Débloque Radar Global à $99/m
          </Link>
          <p className="mt-2 text-[11px] text-zinc-500">Voir winners BR avant tes concurrents</p>
        </div>
      </div>
    </div>
  )
}
