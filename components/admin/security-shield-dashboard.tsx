"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { BentoCard, BentoPageHeading } from "@/components/affisell/bento-ui"
import { cn } from "@/lib/utils"

type ShieldLogRow = {
  ts: string
  ip: string
  type: string
  path: string
  data: unknown
  score?: number
  threats?: string[]
  action?: "ALLOW" | "CHALLENGE" | "BLOCK"
}

type ShieldBanRow = {
  ip: string
  blockedUntil: number
}

type LogsPayload = {
  logs: ShieldLogRow[]
  bans: ShieldBanRow[]
}

function scoreTone(score: number | undefined): string {
  if (score == null) return "text-zinc-500"
  if (score >= 70) return "text-emerald-700"
  if (score >= 40) return "text-amber-700"
  return "text-red-700"
}

function actionBadge(action: string | undefined): string {
  if (action === "BLOCK") return "bg-red-100 text-red-800 border-red-200"
  if (action === "CHALLENGE") return "bg-amber-100 text-amber-900 border-amber-200"
  return "bg-zinc-100 text-zinc-700 border-zinc-200"
}

function computeStats(logs: ShieldLogRow[]) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const recent = logs.filter((l) => new Date(l.ts).getTime() >= dayAgo)
  const blocked = recent.filter((l) => l.action === "BLOCK")
  const uniqueIps = new Set(recent.map((l) => l.ip)).size
  const scores = recent.map((l) => l.score).filter((s): s is number => typeof s === "number")
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100

  const threatCounts = new Map<string, number>()
  for (const row of recent) {
    for (const t of row.threats ?? []) {
      threatCounts.set(t, (threatCounts.get(t) ?? 0) + 1)
    }
  }
  let topThreat = "—"
  let topCount = 0
  for (const [t, c] of threatCounts.entries()) {
    if (c > topCount) {
      topThreat = t
      topCount = c
    }
  }

  return {
    blocked24h: blocked.length,
    uniqueIps,
    topThreat,
    avgScore,
  }
}

export function SecurityShieldDashboard() {
  const [logs, setLogs] = useState<ShieldLogRow[]>([])
  const [bans, setBans] = useState<ShieldBanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banIp, setBanIp] = useState("")
  const [banMinutes, setBanMinutes] = useState(10)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const stats = useMemo(() => computeStats(logs), [logs])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/security/logs?limit=100", {
        credentials: "same-origin",
        cache: "no-store",
      })
      if (!res.ok) {
        setError(res.status === 403 ? "Accès admin requis" : `Erreur ${res.status}`)
        return
      }
      const data = (await res.json()) as LogsPayload
      setLogs(data.logs ?? [])
      setBans(data.bans ?? [])
      setError(null)
    } catch {
      setError("Réseau indisponible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 3000)
    return () => window.clearInterval(id)
  }, [refresh])

  async function handleBan() {
    if (!banIp.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/security/logs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ban", ip: banIp.trim(), minutes: banMinutes }),
      })
      if (!res.ok) throw new Error("ban_failed")
      setBanIp("")
      await refresh()
    } catch {
      setError("Ban manuel échoué")
    } finally {
      setBusy(false)
    }
  }

  async function handleUnban(ip: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/security/logs?ip=${encodeURIComponent(ip)}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) throw new Error("unban_failed")
      await refresh()
    } catch {
      setError("Unban échoué")
    } finally {
      setBusy(false)
    }
  }

  async function runShieldTest() {
    setTestResult(null)
    try {
      const res = await fetch("/api/admin/bypass", { credentials: "same-origin" })
      const text = await res.text()
      setTestResult(`${res.status} — ${text.slice(0, 120)}`)
    } catch {
      setTestResult("Test échoué (réseau)")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🛡️
            </span>
            <BentoPageHeading
              title="Humanoid Shield Live"
              description="Surveillance edge en temps réel — proxy.ts + rate limit + honeypots"
            />
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          PROTECTING
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Blocked 24h", value: stats.blocked24h },
          { label: "Unique IPs", value: stats.uniqueIps },
          { label: "Top threat", value: stats.topThreat },
          { label: "Avg score", value: stats.avgScore },
        ].map((card) => (
          <BentoCard key={card.label} className="border-black/5 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{card.value}</p>
          </BentoCard>
        ))}
      </div>

      <BentoCard className="border-black/5 p-0 shadow-sm overflow-hidden">
        <div className="border-b border-black/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Journal live</h2>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          {loading ? <p className="mt-1 text-xs text-zinc-500">Chargement…</p> : null}
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50/95 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Heure</th>
                <th className="px-3 py-2 font-semibold">IP</th>
                <th className="px-3 py-2 font-semibold">Path</th>
                <th className="px-3 py-2 font-semibold">Threats</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                    Aucun événement — déclenchez un test honeypot
                  </td>
                </tr>
              ) : (
                logs.map((row, idx) => (
                  <tr key={`${row.ts}-${row.ip}-${idx}`} className="border-t border-black/5">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-600">
                      {new Date(row.ts).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{row.ip}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-zinc-700">{row.path}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(row.threats ?? [row.type]).slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={cn("px-3 py-2 font-semibold tabular-nums", scoreTone(row.score))}>
                      {row.score ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                          actionBadge(row.action)
                        )}
                      >
                        {row.action ?? row.type}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </BentoCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <BentoCard className="border-black/5 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Bans actifs</h2>
          <ul className="mt-3 space-y-2">
            {bans.length === 0 ? (
              <li className="text-xs text-zinc-500">Aucun ban actif</li>
            ) : (
              bans.map((ban) => (
                <li
                  key={ban.ip}
                  className="flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-zinc-50/80 px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-zinc-900">{ban.ip}</p>
                    <p className="text-[11px] text-zinc-500">
                      until {new Date(ban.blockedUntil).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleUnban(ban.ip)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Unban
                  </button>
                </li>
              ))
            )}
          </ul>
        </BentoCard>

        <BentoCard className="border-black/5 p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">Actions admin</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={banIp}
              onChange={(e) => setBanIp(e.target.value)}
              placeholder="IP à bannir"
              className="min-w-[140px] flex-1 rounded-xl border border-black/10 px-3 py-2 text-xs"
            />
            <input
              type="number"
              min={1}
              max={10080}
              value={banMinutes}
              onChange={(e) => setBanMinutes(Number(e.target.value) || 10)}
              className="w-20 rounded-xl border border-black/10 px-3 py-2 text-xs tabular-nums"
            />
            <button
              type="button"
              disabled={busy || !banIp.trim()}
              onClick={() => void handleBan()}
              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Ban IP
            </button>
          </div>
          <button
            type="button"
            onClick={() => void runShieldTest()}
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
          >
            Test — GET /api/admin/bypass
          </button>
          {testResult ? (
            <p className="rounded-xl border border-black/5 bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-700">
              {testResult}
            </p>
          ) : null}
        </BentoCard>
      </div>
    </div>
  )
}
