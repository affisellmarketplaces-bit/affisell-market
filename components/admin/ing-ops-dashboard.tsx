"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  Bot,
  Clock,
  Loader2,
  Mail,
  RefreshCw,
  Users,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import type { IngOpsStats } from "@/lib/ing/load-ing-ops-stats"
import { cn } from "@/lib/utils"

type Props = {
  initialStats: IngOpsStats | null
  loadError?: string | null
}

function statusBadge(status: IngOpsStats["status"]) {
  if (status === "operational") {
    return "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
  }
  if (status === "degraded") {
    return "bg-amber-500/15 text-amber-200 ring-amber-400/30"
  }
  return "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30"
}

export function IngOpsDashboard({ initialStats, loadError = null }: Props) {
  const [stats, setStats] = useState<IngOpsStats | null>(initialStats)
  const [loading, setLoading] = useState(!initialStats)
  const [error, setError] = useState<string | null>(loadError)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/ing/stats", { cache: "no-store", credentials: "include" })
      const data = (await res.json()) as IngOpsStats & { error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialStats) void load()
  }, [initialStats, load])

  const kpis = stats?.kpis

  return (
    <BentoShell className="min-h-screen bg-zinc-950 text-zinc-100">
      <BentoContainer className="py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <BentoPageHeading
            eyebrow="Humanoid Ops v2"
            title="Ing Dashboard"
            description="Manual nudge cron · Slack escalation · 48h anti-spam"
          />
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 border-zinc-700")}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </button>
        </div>

        {error && (
          <BentoCard className="mb-6 border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
            {error}
          </BentoCard>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <span className={cn("rounded-full px-3 py-1 ring-1", statusBadge(stats?.status ?? "disabled"))}>
            Ing Status: {stats?.status === "operational" ? "Operational" : stats?.status === "degraded" ? "Degraded" : "Disabled"}
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <Clock className="size-3.5" />
            Last run: {stats?.lastRunRelative ?? "—"}
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <Bot className="size-3.5" />
            Next: tomorrow 9h UTC
          </span>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Manual (7d)", value: kpis?.manualGroups7d ?? "—", icon: AlertTriangle },
            { label: "Nudged today", value: kpis?.nudgedToday ?? "—", icon: Mail },
            { label: "Skipped 48h", value: kpis?.skipped48h ?? "—", icon: Clock },
            { label: "Non-répondants >30j", value: kpis?.nonResponders30d ?? "—", icon: Users },
          ].map((kpi) => (
            <BentoCard key={kpi.label} className="border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                <kpi.icon className="size-3.5" />
                {kpi.label}
              </div>
              <p className="text-2xl font-bold tabular-nums text-violet-200">{kpi.value}</p>
            </BentoCard>
          ))}
        </div>

        {(stats?.escalationCandidates.length ?? 0) > 0 && (
          <BentoCard className="mb-8 border-rose-500/40 bg-rose-950/20 p-4">
            <p className="text-sm font-semibold text-rose-200">
              ⚠️ {stats?.escalationCandidates.length} supplier(s) — 3+ nudges sans réponse (30j)
            </p>
            <ul className="mt-2 space-y-1 text-xs text-rose-100/90">
              {stats?.escalationCandidates.slice(0, 5).map((row) => (
                <li key={row.supplierId}>
                  {row.email} — {row.nudges} nudges, {row.manualGroups} groups
                </li>
              ))}
            </ul>
          </BentoCard>
        )}

        <BentoCard className="mb-8 overflow-hidden border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">
            Suppliers — manual_required
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Supplier</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Groups</th>
                  <th className="px-4 py-2 font-medium">Last nudge</th>
                  <th className="px-4 py-2 font-medium">Nudges</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.suppliers ?? []).map((row) => (
                  <tr key={row.supplierId} className="border-t border-zinc-800/80">
                    <td className="px-4 py-2 text-zinc-200">
                      {row.name}
                      {row.escalated && (
                        <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">
                          ESC
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{row.email}</td>
                    <td className="px-4 py-2 tabular-nums">{row.manualGroups}</td>
                    <td className="px-4 py-2 text-zinc-400">
                      {row.lastNudgeAt ? new Date(row.lastNudgeAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{row.nudgesCount}</td>
                    <td className="px-4 py-2">
                      <a
                        href={`mailto:${row.email}?subject=Affisell%20-%20Connecter%20votre%20boutique`}
                        className="text-violet-400 hover:text-violet-300"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
                {(stats?.suppliers.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No suppliers pending nudge
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </BentoCard>

        <BentoCard className="overflow-hidden border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">
            Timeline — recent nudges
          </div>
          <ul className="divide-y divide-zinc-800/80">
            {(stats?.timeline ?? []).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
                <Mail className="size-3.5 text-violet-400" />
                <span className="text-zinc-300">{entry.email}</span>
                <span className="text-zinc-500">{entry.groupsCount} groups</span>
                <span className="font-mono text-zinc-500">{entry.resendId ?? "no resendId"}</span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5",
                    entry.status === "sent" && "bg-emerald-500/15 text-emerald-300",
                    entry.status === "bounced" && "bg-red-500/15 text-red-300",
                    entry.status === "unknown" && "bg-zinc-700/50 text-zinc-400"
                  )}
                >
                  {entry.status}
                </span>
                <span className="ml-auto text-zinc-500">{new Date(entry.sentAt).toLocaleString()}</span>
              </li>
            ))}
            {(stats?.timeline.length ?? 0) === 0 && (
              <li className="px-4 py-8 text-center text-zinc-500">No nudge logs yet</li>
            )}
          </ul>
        </BentoCard>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Ing AI panel:{" "}
          <a href="/dashboard/admin/ing" className="text-violet-400 hover:underline">
            /dashboard/admin/ing
          </a>
        </p>
      </BentoContainer>
    </BentoShell>
  )
}
