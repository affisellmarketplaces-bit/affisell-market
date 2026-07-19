"use client"

import { useEffect, useState } from "react"

type HealthPayload = {
  encryptionKey?: boolean
  redis?: boolean
  degradedCrawler?: boolean
  tiktokCrawler?: boolean
  serper?: boolean
  db?: boolean
}

function Flag({ ok, label, fix }: { ok: boolean; label: string; fix?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-medium ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"}`}>
        {ok ? "OK" : "MISSING"}
      </p>
      {!ok && fix ? <p className="mt-1 text-[11px] text-zinc-500">{fix}</p> : null}
    </div>
  )
}

/** Polls /api/radar/health for ENCRYPTION_KEY / REDIS / crawler flags. */
export function AdminRadarHealthFlags() {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/radar/health", { credentials: "include" })
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? "Radar désactivé (RADAR_ENABLED)" : `HTTP ${res.status}`)
          return
        }
        const data = (await res.json()) as HealthPayload
        if (!cancelled) setHealth(data)
      } catch {
        if (!cancelled) setError("Health unreachable")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Health P0</p>
      <p className="mt-1 text-xs text-zinc-500">
        Source : <code className="text-[11px]">GET /api/radar/health</code>
      </p>
      {error ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>
      ) : !health ? (
        <p className="mt-3 text-sm text-zinc-500">Chargement…</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Flag
            ok={Boolean(health.encryptionKey)}
            label="ENCRYPTION_KEY"
            fix="openssl rand -hex 16 → Vercel"
          />
          <Flag
            ok={Boolean(health.redis)}
            label="REDIS_URL"
            fix="Upstash rediss://… (cron lock → memory OK)"
          />
          <Flag
            ok={!health.degradedCrawler}
            label="Crawler"
            fix="TIKTOK_CRAWLER_ACCESS_TOKEN (degraded OK)"
          />
        </div>
      )}
    </div>
  )
}
