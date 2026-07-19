"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export type CountryStatusProp = {
  country: string
  label: string
  snapshots: number
}

const TRIGGER_COUNTRIES = "FR,US,MX"

/** Admin QA — parallel multi-country crawl trigger (session; no CRON_SECRET in browser). */
export function AdminRadarMultiCountryCrawl({
  statuses,
}: {
  statuses: CountryStatusProp[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function trigger() {
    setLoading(true)
    try {
      const res = await fetch("/api/radar/scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countries: TRIGGER_COUNTRIES }),
      })
      const data = (await res.json()) as {
        error?: string
        started?: boolean
        scanned?: number
        countries?: string[]
        jobs?: Array<{ country: string; snapshots: number; products: number; errors: string[] }>
      }
      if (!res.ok) {
        toast.error(data.error ?? `HTTP ${res.status}`)
        return
      }
      const jobSummary = (data.jobs ?? [])
        .map((j) => `${j.country}:${j.snapshots}`)
        .join(" · ")
      toast.success(
        `Crawl OK — ${data.scanned ?? 0} snapshots (${data.countries?.join(",") ?? TRIGGER_COUNTRIES})${jobSummary ? ` · ${jobSummary}` : ""}`
      )
      router.refresh()
    } catch {
      toast.error("Crawl failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Multi-Country Crawl</p>
      <p className="mt-1 text-xs text-zinc-500">
        Parallel FR/US/MX via <code className="text-[11px]">Promise.allSettled</code> + lock{" "}
        <code className="text-[11px]">radar:global-scan:{"{country}:{day}"}</code>. Cron:{" "}
        <code className="text-[11px]">GET /api/radar/cron/global-scan?countries=FR,US,MX</code>
      </p>
      <ul className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
        {statuses.map((s) => (
          <li key={s.country} className="flex justify-between gap-3 border-b border-zinc-100 py-1 dark:border-zinc-900">
            <span className="font-medium">{s.country}</span>
            <span className="text-xs text-zinc-500">{s.label}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={loading}
        onClick={() => void trigger()}
        className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
      >
        {loading ? "Crawl…" : "Trigger Global Crawl (FR/US/MX)"}
      </button>
    </div>
  )
}
