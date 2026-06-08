"use client"

import Link from "next/link"
import { useCallback, useMemo, useState, useTransition } from "react"
import { Activity, BarChart3, Radar, RefreshCw, Shield, Zap } from "lucide-react"
import { toast } from "sonner"

import { AdminBookingStatsStrip } from "@/components/admin/admin-booking-stats-strip"
import { SentinelTrendStrip } from "@/app/admin/sentinel/sentinel-trend-strip"
import {
  DOMAINS,
  SENTINEL_DOMAIN_LABEL,
  SEVERITIES,
  isExternalPlaybookUrl,
  sentinelPlaybookKind,
  sentinelPlaybookLabel,
  sentinelPlaybookSecondaryUrl,
  sentinelPlaybookUrl,
} from "@/lib/sentinel/sentinel-shared"
import { computeSentinelScore } from "@/lib/sentinel/score"
import type { SentinelDashboard, SentinelSeverity } from "@/lib/sentinel/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  initial: SentinelDashboard
}

const SEV_STYLE: Record<SentinelSeverity, string> = {
  P0: "border-rose-500/50 bg-rose-500/15 text-rose-100",
  P1: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  P2: "border-sky-500/35 bg-sky-500/10 text-sky-100",
  P3: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function SentinelDashboardClient({ initial }: Props) {
  const [data, setData] = useState(initial)
  const [filter, setFilter] = useState<SentinelSeverity | "all">("all")
  const [pending, startTransition] = useTransition()
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [playbookId, setPlaybookId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === "all") return data.signals
    return data.signals.filter((s) => s.severity === filter)
  }, [data.signals, filter])

  const scoreTone =
    data.score >= 85 ? "text-emerald-400" : data.score >= 60 ? "text-amber-400" : "text-rose-400"

  const runScan = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/sentinel/scan", { method: "POST", credentials: "include" })
        const body = (await res.json()) as { dashboard?: SentinelDashboard; error?: string }
        if (!res.ok) throw new Error(body.error ?? "Scan failed")
        if (body.dashboard) setData(body.dashboard)
        toast.success("Scan Sentinel terminé")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Scan impossible")
      }
    })
  }, [])

  const resolveSignal = useCallback((id: string) => {
    setResolvingId(id)
    void fetch(`/api/admin/sentinel/${id}/resolve`, { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error ?? "Resolve failed")
        }
        setData((prev) => {
          const nextCounts = { ...prev.openCounts }
          const sev = prev.signals.find((s) => s.id === id)?.severity
          if (sev) nextCounts[sev] = Math.max(0, nextCounts[sev] - 1)
          return {
            ...prev,
            score: computeSentinelScore(nextCounts),
            openCounts: nextCounts,
            signals: prev.signals.filter((s) => s.id !== id),
          }
        })
        toast.success("Signal archivé")
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setResolvingId(null))
  }, [])

  const runPlaybook = useCallback((signalId: string) => {
    setPlaybookId(signalId)
    void fetch(`/api/admin/sentinel/${signalId}/playbook`, { method: "POST", credentials: "include" })
      .then(async (res) => {
        const body = (await res.json()) as { error?: string; queue?: string }
        if (!res.ok) throw new Error(body.error ?? "Playbook failed")
        toast.success(`Auto-buy relancé (${body.queue ?? "queue"})`)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Action impossible"))
      .finally(() => setPlaybookId(null))
  }, [])

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.18),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-400/90">
              <Radar className="size-3.5" aria-hidden />
              Affisell Sentinel
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
              Ops Command Center
            </h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Détection automatique — paiements, webhooks, auto-fulfill, catalogue, i18n, Sentry, providers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={runScan}
              className="border-violet-500/40 bg-violet-950/40 text-violet-100 hover:bg-violet-900/50"
            >
              <RefreshCw className={cn("mr-1.5 size-4", pending && "animate-spin")} aria-hidden />
              Scan now
            </Button>
            <span className="text-xs text-zinc-500">Dernier scan : {formatWhen(data.scannedAt)}</span>
          </div>
        </div>

        <AdminBookingStatsStrip className="mt-6" />

        <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,200px)_1fr] lg:grid-cols-[220px_1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-inner shadow-black/30 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Health score</p>
            <p className={cn("mt-2 text-5xl font-bold tabular-nums", scoreTone)}>{data.score}</p>
            <p className="mt-1 text-xs text-zinc-500">/ 100</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400/90">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live monitoring
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl lg:col-span-1">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Shield className="size-3.5" aria-hidden />
              Sévérité
            </p>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setFilter((f) => (f === sev ? "all" : sev))}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-center transition",
                    SEV_STYLE[sev],
                    filter === sev && "ring-2 ring-violet-500/50"
                  )}
                >
                  <span className="block text-lg font-bold tabular-nums">{data.openCounts[sev]}</span>
                  <span className="text-[10px] font-semibold opacity-80">{sev}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl md:col-span-2 lg:col-span-1">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Activity className="size-3.5" aria-hidden />
              Domaines
            </p>
            <ul className="space-y-2">
              {DOMAINS.map((d) => (
                <li key={d} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{SENTINEL_DOMAIN_LABEL[d]}</span>
                  <span className="tabular-nums text-zinc-500">
                    {data.domainCounts[d].open}
                    {data.domainCounts[d].p0 > 0 ? (
                      <Badge className="ml-2 border-rose-500/40 bg-rose-500/20 text-[10px] text-rose-100">
                        {data.domainCounts[d].p0} P0
                      </Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <SentinelTrendStrip points={data.trend7d} />
        </div>

        {data.metabaseEmbedUrl ? (
          <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <BarChart3 className="size-3.5" aria-hidden />
              Metabase · ops metrics
            </div>
            <iframe
              title="Metabase ops dashboard"
              src={data.metabaseEmbedUrl}
              className="h-[420px] w-full border-0 bg-zinc-950"
              loading="lazy"
            />
          </section>
        ) : null}

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              <Zap className="size-4 text-violet-400" aria-hidden />
              Signaux actifs ({filtered.length})
            </h2>
            {filter !== "all" ? (
              <button
                type="button"
                className="text-xs text-violet-400 hover:underline"
                onClick={() => setFilter("all")}
              >
                Tout afficher
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-10 text-center text-sm text-emerald-200/90">
              Aucun signal ouvert — plateforme saine sur les checks Sentinel.
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((s) => {
                const href = sentinelPlaybookUrl(s.playbook, s.entityId ?? null)
                const kind = sentinelPlaybookKind(s.playbook)
                const secondaryHref = sentinelPlaybookSecondaryUrl(s.playbook)
                const playbookBtnClass =
                  "inline-flex items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                return (
                  <li
                    key={s.id}
                    className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-inner shadow-black/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("border text-[10px] font-bold", SEV_STYLE[s.severity])}>
                            {s.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase text-zinc-400">
                            {SENTINEL_DOMAIN_LABEL[s.domain]}
                          </Badge>
                          {s.metric != null ? (
                            <span className="text-[10px] tabular-nums text-zinc-500">×{s.metric}</span>
                          ) : null}
                        </div>
                        <p className="mt-2 font-medium text-white">{s.title}</p>
                        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-zinc-400">{s.detail}</p>
                        <p className="mt-2 text-[10px] text-zinc-600">
                          Vu {formatWhen(s.lastSeenAt)} · code {s.code}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        {kind === "action" ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={playbookId === s.id}
                            onClick={() => runPlaybook(s.id)}
                            className="bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500"
                          >
                            {sentinelPlaybookLabel(s.playbook)}
                          </Button>
                        ) : href && isExternalPlaybookUrl(href) ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={playbookBtnClass}
                          >
                            {sentinelPlaybookLabel(s.playbook)}
                          </a>
                        ) : href ? (
                          <Link href={href} className={playbookBtnClass}>
                            {sentinelPlaybookLabel(s.playbook)}
                          </Link>
                        ) : null}
                        {secondaryHref ? (
                          <Link
                            href={secondaryHref}
                            className="text-center text-[11px] text-violet-400 hover:underline"
                          >
                            Voir les logs
                          </Link>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resolvingId === s.id}
                          onClick={() => resolveSignal(s.id)}
                          className="border-zinc-700 bg-transparent text-xs text-zinc-300"
                        >
                          Archiver
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
