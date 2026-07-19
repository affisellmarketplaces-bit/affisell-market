"use client"

import { useEffect, useState } from "react"

type ConnectorRow = {
  id: string
  name: string
  logo: string
  region: string
  status: "live" | "stub"
  requiresAuth?: boolean
  countries?: string[]
}

/** Live connectors grid for /admin/radar QA. */
export function AdminRadarConnectorsGrid() {
  const [rows, setRows] = useState<ConnectorRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/radar/connectors", { credentials: "include" })
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? "Radar off" : `HTTP ${res.status}`)
          return
        }
        const data = (await res.json()) as { connectors?: ConnectorRow[] }
        const live = (data.connectors ?? []).filter((c) => c.status === "live")
        if (!cancelled) setRows(live)
      } catch {
        if (!cancelled) setError("Connectors unreachable")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Connectors</p>
      <p className="mt-1 text-xs text-zinc-500">
        Live sources — Shopee = SEA public crawl (no OAuth).
      </p>
      {error ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>
      ) : !rows ? (
        <p className="mt-3 text-sm text-zinc-500">Chargement…</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <span className="mr-1" aria-hidden>
                  {c.logo}
                </span>
                {c.name}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">🟢 Live</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {c.region}
                {c.countries && c.countries.length > 0
                  ? ` · ${c.countries.slice(0, 5).join("/")}`
                  : ""}
                {c.requiresAuth === false ? " · public" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
