import { getTranslations } from "next-intl/server"
import { ShoppingBag } from "lucide-react"

import type { ChinaBuySnapshot } from "@/lib/china-buying/load-china-buy-snapshot"
import { AGENTS } from "@/lib/agents"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<string, string> = {
  STUB: "border-amber-400/30 bg-amber-500/15 text-amber-200",
  ROUTED: "border-sky-400/30 bg-sky-500/15 text-sky-200",
  API_OK: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  API_FAIL: "border-red-400/30 bg-red-500/15 text-red-300",
}

function agentLabel(id: string): string {
  return AGENTS.find((a) => a.id === id)?.name ?? id
}

type Props = {
  snapshot: ChinaBuySnapshot
}

export async function ChinaBuyRoutesPanel({ snapshot }: Props) {
  const t = await getTranslations("supplierDashboard.chinaBuy")

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-950 to-zinc-950 p-6 text-zinc-100 shadow-xl">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 ring-1 ring-blue-400/30">
          <ShoppingBag className="h-5 w-5 text-blue-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          <p className="mt-1 text-sm text-zinc-400">{t("subtitle")}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label={t("statsProducts")} value={String(snapshot.productsWithAgent)} />
        <Stat label={t("statsRoutes")} value={String(snapshot.routedCount)} />
        <Stat label={t("statsApiOk")} value={String(snapshot.apiOkCount)} />
      </div>

      {snapshot.recentRoutes.length === 0 ? (
        <p className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-zinc-400">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {snapshot.recentRoutes.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-medium",
                    STATUS_STYLE[r.status] ?? ""
                  )}
                >
                  {r.status}
                </span>
                <span className="font-medium text-zinc-100">{agentLabel(r.agentId)}</span>
                {r.platform ? (
                  <span className="text-zinc-500">· {r.platform}</span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-zinc-400">
                {r.productName ?? r.sourceUrl}
                {r.externalRef ? ` · ref ${r.externalRef}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-50">{value}</p>
    </div>
  )
}
