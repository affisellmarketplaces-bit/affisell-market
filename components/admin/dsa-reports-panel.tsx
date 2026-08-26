"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DsaReportRow = {
  id: string
  type: string
  reporterEmail: string
  productId: string | null
  description: string
  status: string
  createdAt: string
  actionTaken: string | null
}

const STATUS_FILTERS = ["all", "new", "reviewing", "action_taken", "rejected"] as const

export function DsaReportsPanel() {
  const [reports, setReports] = useState<DsaReportRow[]>([])
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("new")
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`
      const res = await fetch(`/api/legal/dsa-report${qs}`, { credentials: "include", cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; reports?: DsaReportRow[]; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setReports(data.reports ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function updateReport(id: string, status: "reviewing" | "action_taken" | "rejected", actionTaken?: string) {
    setProcessing(id)
    setError(null)
    try {
      const res = await fetch("/api/legal/dsa-report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status, actionTaken }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "update_failed")
    } finally {
      setProcessing(null)
    }
  }

  return (
    <BentoCard className="border-zinc-800 bg-zinc-950/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-400" aria-hidden />
          <p className="text-sm font-semibold text-white">Signalements DSA</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                buttonVariants({ variant: filter === s ? "default" : "outline", size: "sm" }),
                "h-7 text-[10px]",
                filter === s ? "bg-amber-700" : "border-zinc-700"
              )}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-zinc-500" />
        </div>
      ) : reports.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500">Aucun signalement.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-300">{r.type}</p>
                  <p className="mt-1 text-sm text-zinc-200">{r.description.slice(0, 200)}</p>
                  <p className="mt-2 text-[10px] text-zinc-500">
                    {r.reporterEmail} · {new Date(r.createdAt).toLocaleString("fr-FR")}
                    {r.productId ? ` · Produit ${r.productId}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                  {r.status}
                </span>
              </div>
              {r.status === "new" || r.status === "reviewing" ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.status === "new" ? (
                    <button
                      type="button"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-[10px]")}
                      disabled={processing === r.id}
                      onClick={() => void updateReport(r.id, "reviewing")}
                    >
                      Traiter
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={cn(buttonVariants({ size: "sm" }), "h-7 text-[10px] bg-emerald-800")}
                    disabled={processing === r.id}
                    onClick={() =>
                      void updateReport(
                        r.id,
                        "action_taken",
                        "Contenu examiné et mesure prise conformément à l'art. 16 DSA (déréférencement / avertissement trader)."
                      )
                    }
                  >
                    Action prise
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-7 text-[10px]")}
                    disabled={processing === r.id}
                    onClick={() => void updateReport(r.id, "rejected", "Signalement non fondé après examen.")}
                  >
                    Rejeter
                  </button>
                </div>
              ) : r.actionTaken ? (
                <p className="mt-2 text-xs text-zinc-400">{r.actionTaken}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  )
}
