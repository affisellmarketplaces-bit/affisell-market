"use client"

import Link from "next/link"
import { useCallback, useState, useTransition } from "react"
import {
  Activity,
  ArrowUpRight,
  Fingerprint,
  Headphones,
  Package,
  Radar,
  RefreshCw,
  Shield,
  Star,
  Terminal,
} from "lucide-react"
import { toast } from "sonner"

import type { AdminTerminalOverview, TerminalFeedItem } from "@/lib/admin/terminal/load-terminal-overview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  initial: AdminTerminalOverview
}

const TONE_RING: Record<string, string> = {
  rose: "from-rose-500/30 to-rose-600/5 shadow-rose-500/20",
  amber: "from-amber-500/30 to-amber-600/5 shadow-amber-500/20",
  violet: "from-violet-500/30 to-violet-600/5 shadow-violet-500/20",
  sky: "from-sky-500/30 to-sky-600/5 shadow-sky-500/20",
  emerald: "from-emerald-500/30 to-emerald-600/5 shadow-emerald-500/20",
}

const TONE_TEXT: Record<string, string> = {
  rose: "text-rose-300",
  amber: "text-amber-300",
  violet: "text-violet-300",
  sky: "text-sky-300",
  emerald: "text-emerald-300",
}

const FEED_ICON: Record<TerminalFeedItem["kind"], typeof Radar> = {
  signal: Radar,
  ticket: Headphones,
  return: Package,
  kyc: Fingerprint,
  review: Star,
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

export function AdminTerminalHub({ initial }: Props) {
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()

  const scoreTone =
    data.sentinelScore >= 85 ? "text-emerald-400" : data.sentinelScore >= 60 ? "text-amber-400" : "text-rose-400"

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/terminal/overview", { credentials: "include" })
        const body = (await res.json()) as AdminTerminalOverview & { error?: string }
        if (!res.ok) throw new Error(body.error ?? "refresh_failed")
        setData(body)
        toast.success("Terminal synchronisé")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur")
      }
    })
  }, [])

  const totalActive = data.queues.reduce((n, q) => n + (q.id === "orders" ? 0 : q.count), 0)

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.04]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(56,189,248,0.18),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(139,92,246,0.12),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sky-400/90">
              <Terminal className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">Data Terminal</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Mission Control</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Hub unifié — Sentinel, KYC, support, retours et modération en une vue temps réel.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-white/15 bg-white/5 text-zinc-300">
              <Activity className="mr-1 h-3 w-3" />
              {totalActive} file{totalActive > 1 ? "s" : ""} actives
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={pending}
              className="border-white/15 bg-white/5 hover:bg-white/10"
            >
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", pending && "animate-spin")} />
              Sync
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_50%,rgba(56,189,248,0.15),transparent,rgba(139,92,246,0.15),transparent)]" />
            <div className="relative flex flex-col items-center text-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-sky-500/20" />
                <div className="absolute inset-2 rounded-full border border-violet-500/15" />
                <div className="absolute inset-0 animate-pulse rounded-full bg-sky-500/5" />
                <Shield className="absolute -top-1 h-5 w-5 text-sky-400/60" />
                <span className={cn("text-4xl font-bold tabular-nums", scoreTone)}>{data.sentinelScore}</span>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sentinel Score</p>
              <p className="mt-1 text-[11px] text-zinc-500">Scan {formatWhen(data.scannedAt)}</p>
              <Link
                href="/admin/sentinel"
                className="mt-4 inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
              >
                Ouvrir Sentinel <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.queues.map((q) => (
              <Link
                key={q.id}
                href={q.href}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4 shadow-lg backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.06]",
                  TONE_RING[q.tone]
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{q.label}</p>
                    <p className={cn("mt-1 text-3xl font-bold tabular-nums", TONE_TEXT[q.tone])}>{q.count}</p>
                    <p className="mt-1 text-xs text-zinc-500">{q.hint}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-zinc-600 transition group-hover:text-zinc-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Flux opérationnel</h2>
            <span className="text-[10px] text-zinc-600">12 derniers signaux cross-queue</span>
          </div>
          <ul className="divide-y divide-white/5">
            {data.feed.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-zinc-500">Aucune activité récente — plateforme au vert.</li>
            ) : (
              data.feed.map((item) => {
                const Icon = FEED_ICON[item.kind]
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.03]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                        <Icon className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-zinc-500">{item.detail}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {item.severity ? (
                          <Badge className="mb-1 border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-200">
                            {item.severity}
                          </Badge>
                        ) : null}
                        <p className="text-[10px] text-zinc-600">{formatWhen(item.at)}</p>
                      </div>
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
