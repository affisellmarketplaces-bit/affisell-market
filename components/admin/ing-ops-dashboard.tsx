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
import {
  ADMIN_COCKPIT_ATMOSPHERE,
  ADMIN_COCKPIT_CARD,
  ADMIN_COCKPIT_CARD_ACCENT,
  ADMIN_COCKPIT_HEADING,
  ADMIN_COCKPIT_KPI_LABEL,
  ADMIN_COCKPIT_KPI_VALUE,
  ADMIN_COCKPIT_LINK,
  ADMIN_COCKPIT_SHELL,
  ADMIN_COCKPIT_TABLE_HEAD,
  ADMIN_COCKPIT_TABLE_ROW,
  ADMIN_COCKPIT_TABLE_WRAP,
  ADMIN_COCKPIT_TEXT_MUTED,
  ADMIN_COCKPIT_TEXT_SECONDARY,
  adminStatusBadgeDegraded,
  adminStatusBadgeDisabled,
  adminStatusBadgeOperational,
} from "@/components/admin/admin-cockpit-ui"
import { buttonVariants } from "@/components/ui/button"
import type { IngOpsStats } from "@/lib/ing/load-ing-ops-stats"
import { cn } from "@/lib/utils"

type Props = {
  initialStats: IngOpsStats | null
  loadError?: string | null
}

function statusBadge(status: IngOpsStats["status"]) {
  if (status === "operational") return adminStatusBadgeOperational()
  if (status === "degraded") return adminStatusBadgeDegraded()
  return adminStatusBadgeDisabled()
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
    <div className="relative min-h-[80vh] overflow-hidden">
      <div className={ADMIN_COCKPIT_ATMOSPHERE} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(9,9,11,0.35))]"
        aria-hidden
      />

      <BentoShell className={cn("relative", ADMIN_COCKPIT_SHELL)}>
        <BentoContainer className="py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <BentoPageHeading
              className={ADMIN_COCKPIT_HEADING}
              tone="dark"
              eyebrow="Humanoid Ops v2"
              title="Ing Dashboard"
              description="Manual nudge cron · Slack escalation · 48h anti-spam"
            />
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-2 border-zinc-600 bg-zinc-900/90 text-zinc-100 hover:border-violet-500/45 hover:bg-zinc-800 hover:text-white"
              )}
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </button>
          </div>

          {error && (
            <BentoCard variant="dark" className="mb-6 border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100">
              {error}
            </BentoCard>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <span className={cn("rounded-full px-3 py-1 font-medium ring-1", statusBadge(stats?.status ?? "disabled"))}>
              Ing Status:{" "}
              {stats?.status === "operational"
                ? "Operational"
                : stats?.status === "degraded"
                  ? "Degraded"
                  : "Disabled"}
            </span>
            <span className={cn("flex items-center gap-1.5", ADMIN_COCKPIT_TEXT_MUTED)}>
              <Clock className="size-3.5" />
              Last run: {stats?.lastRunRelative ?? "—"}
            </span>
            <span className={cn("flex items-center gap-1.5", ADMIN_COCKPIT_TEXT_MUTED)}>
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
              <BentoCard key={kpi.label} variant="dark" className={cn(ADMIN_COCKPIT_CARD, ADMIN_COCKPIT_CARD_ACCENT, "!p-4")}>
                <div className={cn("mb-2 flex items-center gap-2", ADMIN_COCKPIT_KPI_LABEL)}>
                  <kpi.icon className="size-3.5 text-violet-300" />
                  {kpi.label}
                </div>
                <p className={ADMIN_COCKPIT_KPI_VALUE}>{kpi.value}</p>
              </BentoCard>
            ))}
          </div>

          {(stats?.escalationCandidates.length ?? 0) > 0 && (
            <BentoCard variant="dark" className="mb-8 border-rose-500/45 bg-rose-950/25 p-4">
              <p className="text-sm font-semibold text-rose-100">
                ⚠️ {stats?.escalationCandidates.length} supplier(s) — 3+ nudges sans réponse (30j)
              </p>
              <ul className="mt-2 space-y-1 text-xs text-rose-50/90">
                {stats?.escalationCandidates.slice(0, 5).map((row) => (
                  <li key={row.supplierId}>
                    {row.email} — {row.nudges} nudges, {row.manualGroups} groups
                  </li>
                ))}
              </ul>
            </BentoCard>
          )}

          <BentoCard variant="dark" className={cn(ADMIN_COCKPIT_CARD, "mb-8 overflow-hidden !p-0")}>
            <div className={cn("border-b border-zinc-700 px-4 py-3 text-sm font-semibold", ADMIN_COCKPIT_TEXT_SECONDARY)}>
              Suppliers — manual_required
            </div>
            <div className={ADMIN_COCKPIT_TABLE_WRAP}>
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className={ADMIN_COCKPIT_TABLE_HEAD}>
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Supplier</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Groups</th>
                    <th className="px-4 py-2.5 font-medium">Last nudge</th>
                    <th className="px-4 py-2.5 font-medium">Nudges</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.suppliers ?? []).map((row) => (
                    <tr key={row.supplierId} className={ADMIN_COCKPIT_TABLE_ROW}>
                      <td className={cn("px-4 py-2.5", ADMIN_COCKPIT_TEXT_SECONDARY)}>
                        {row.name}
                        {row.escalated && (
                          <span className="ml-2 rounded bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100">
                            ESC
                          </span>
                        )}
                      </td>
                      <td className={cn("px-4 py-2.5", ADMIN_COCKPIT_TEXT_MUTED)}>{row.email}</td>
                      <td className="px-4 py-2.5 tabular-nums text-zinc-200">{row.manualGroups}</td>
                      <td className={cn("px-4 py-2.5", ADMIN_COCKPIT_TEXT_MUTED)}>
                        {row.lastNudgeAt ? new Date(row.lastNudgeAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-zinc-200">{row.nudgesCount}</td>
                      <td className="px-4 py-2.5">
                        <a
                          href={`mailto:${row.email}?subject=Affisell%20-%20Connecter%20votre%20boutique`}
                          className={ADMIN_COCKPIT_LINK}
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                  {(stats?.suppliers.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={6} className={cn("px-4 py-8 text-center", ADMIN_COCKPIT_TEXT_MUTED)}>
                        No suppliers pending nudge
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </BentoCard>

          <BentoCard variant="dark" className={cn(ADMIN_COCKPIT_CARD, "overflow-hidden !p-0")}>
            <div className={cn("border-b border-zinc-700 px-4 py-3 text-sm font-semibold", ADMIN_COCKPIT_TEXT_SECONDARY)}>
              Timeline — recent nudges
            </div>
            <ul className="divide-y divide-zinc-800/90">
              {(stats?.timeline ?? []).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
                  <Mail className="size-3.5 text-violet-300" />
                  <span className={ADMIN_COCKPIT_TEXT_SECONDARY}>{entry.email}</span>
                  <span className={ADMIN_COCKPIT_TEXT_MUTED}>{entry.groupsCount} groups</span>
                  <span className="font-mono text-zinc-500">{entry.resendId ?? "no resendId"}</span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-medium",
                      entry.status === "sent" && "bg-emerald-500/20 text-emerald-100",
                      entry.status === "bounced" && "bg-red-500/20 text-red-100",
                      entry.status === "unknown" && "bg-zinc-700/60 text-zinc-300"
                    )}
                  >
                    {entry.status}
                  </span>
                  <span className={cn("ml-auto", ADMIN_COCKPIT_TEXT_MUTED)}>
                    {new Date(entry.sentAt).toLocaleString()}
                  </span>
                </li>
              ))}
              {(stats?.timeline.length ?? 0) === 0 && (
                <li className={cn("px-4 py-8 text-center", ADMIN_COCKPIT_TEXT_MUTED)}>No nudge logs yet</li>
              )}
            </ul>
          </BentoCard>

          <p className={cn("mt-6 text-center text-xs", ADMIN_COCKPIT_TEXT_MUTED)}>
            Ing AI panel:{" "}
            <a href="/dashboard/admin/ing" className={cn(ADMIN_COCKPIT_LINK, "hover:underline")}>
              /dashboard/admin/ing
            </a>
          </p>
        </BentoContainer>
      </BentoShell>
    </div>
  )
}
