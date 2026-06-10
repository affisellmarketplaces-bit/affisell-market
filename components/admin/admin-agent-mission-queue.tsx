"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type MissionItem = {
  id: string
  type: string
  status: string
  feeCents: number
  autoBuyPaused: boolean
  reportSummary: string | null
  requestedAt: string
  productName: string | null
  agentName: string | null
  supplierLabel: string
}

const NEXT_ACTIONS: Record<string, { to: string; label: string; tone: "default" | "ok" | "danger" }[]> = {
  REQUESTED: [{ to: "CANCELLED", label: "Annuler", tone: "danger" }],
  ASSIGNED: [
    { to: "IN_PROGRESS", label: "Démarrer", tone: "default" },
    { to: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  IN_PROGRESS: [
    { to: "PASSED", label: "Valider ✓", tone: "ok" },
    { to: "FAILED", label: "Échec (Quality Gate)", tone: "danger" },
  ],
}

const STATUS_BADGE: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ASSIGNED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  IN_PROGRESS: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  PASSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  CANCELLED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
}

export function AdminAgentMissionQueue({ missions }: { missions: MissionItem[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function transition(missionId: string, to: string) {
    setError(null)
    setPendingId(missionId)
    let reportSummary: string | undefined
    if (to === "PASSED" || to === "FAILED") {
      reportSummary = window.prompt("Résumé du rapport (visible fournisseur) :") ?? undefined
    }
    try {
      const res = await fetch(`/api/admin/agent-missions/${missionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, ...(reportSummary ? { reportSummary } : {}) }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(json?.error ?? `Erreur ${res.status}`)
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError("Réseau indisponible — réessayez.")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        File de missions ({missions.length})
      </h2>
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {missions.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">Aucune mission pour le moment.</p>
        ) : null}
        {missions.map((m) => {
          const actions = NEXT_ACTIONS[m.status] ?? []
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3 dark:border-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[m.status] ?? ""}`}
                  >
                    {m.status}
                  </span>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {m.type}
                  </span>
                  {m.autoBuyPaused ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                      Auto-buy coupé
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                  {m.productName ?? "—"} · Fournisseur : {m.supplierLabel} · Agent :{" "}
                  {m.agentName ?? "non assigné"} · {(m.feeCents / 100).toFixed(2)} €
                </p>
                {m.reportSummary ? (
                  <p className="mt-1 text-xs italic text-zinc-500">« {m.reportSummary} »</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {actions.map((a) => (
                  <button
                    key={a.to}
                    type="button"
                    disabled={pendingId === m.id}
                    onClick={() => transition(m.id, a.to)}
                    className={
                      a.tone === "ok"
                        ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        : a.tone === "danger"
                          ? "rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                          : "rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    }
                  >
                    {pendingId === m.id ? "…" : a.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
