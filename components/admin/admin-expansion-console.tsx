"use client"

import { useState, useTransition } from "react"
import { Bell, Globe2, Rocket, Zap } from "lucide-react"
import { toast } from "sonner"

import type { AdminExpansionOverview } from "@/lib/admin/load-admin-expansion-overview"
import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Props = {
  initial: AdminExpansionOverview
}

export function AdminExpansionConsole({ initial }: Props) {
  const [overview, setOverview] = useState(initial)
  const [pending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const res = await fetch("/api/admin/expansion", { cache: "no-store" })
      if (!res.ok) {
        toast.error("Could not refresh expansion data")
        return
      }
      const data = (await res.json()) as AdminExpansionOverview
      setOverview(data)
    })
  }

  async function enableCountry(countryIso2: string) {
    const res = await fetch("/api/admin/expansion/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryIso2 }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Enable failed")
      return
    }
    toast.success(`Checkout enabled for ${countryIso2}`)
    refresh()
  }

  async function notifyCountry(countryIso2: string) {
    const res = await fetch("/api/admin/expansion/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryIso2 }),
    })
    const data = (await res.json()) as { ok?: boolean; sent?: number; failed?: number; error?: string }
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Notify failed")
      return
    }
    toast.success(`Sent ${data.sent ?? 0} launch email(s)${data.failed ? ` · ${data.failed} failed` : ""}`)
    refresh()
  }

  async function runPilot() {
    const res = await fetch("/api/admin/expansion/pilot", { method: "POST" })
    const data = (await res.json()) as {
      ok?: boolean
      countryIso2?: string
      waitlistCount?: number
      notify?: { sent: number; failed: number }
      error?: string
    }
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Pilot failed")
      return
    }
    toast.success(
      `Pilot ${data.countryIso2} — ${data.waitlistCount ?? 0} waitlist · ${data.notify?.sent ?? 0} emails sent`
    )
    refresh()
  }

  const topCountry = overview.countries[0]

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Expansion ROW</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Country-by-country checkout
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Enable one country at a time from waitlist demand, then notify buyers who asked for launch alerts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={refresh}>
            Refresh
          </Button>
          {topCountry && !topCountry.enabled ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => void runPilot()}>
              <Zap className="mr-1.5 size-3.5" aria-hidden />
              Pilot top country ({topCountry.countryIso2})
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Live checkout countries" value={overview.liveCheckoutCount} />
        <MetricCard label="ROW rollouts enabled" value={overview.rolloutCount} />
        <MetricCard label="Waitlist signups" value={overview.totalWaitlist} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Globe2 className="size-4 text-violet-600" aria-hidden />
            Demand by country
          </h2>
        </div>
        {overview.countries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">No ROW waitlist signups yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {overview.countries.map((row) => (
              <li key={row.countryIso2} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {expansionCountryLabel(row.countryIso2, "en")} ({row.countryIso2})
                    </span>
                    {row.enabled ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Checkout on</Badge>
                    ) : (
                      <Badge variant="outline">Waiting</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {row.waitlistCount} signup{row.waitlistCount === 1 ? "" : "s"}
                    {row.pendingNotifyCount > 0 ? ` · ${row.pendingNotifyCount} pending email` : ""}
                    {row.launchEmailSentAt ? ` · last notify ${new Date(row.launchEmailSentAt).toLocaleDateString()}` : ""}
                    {row.firstOrderAt
                      ? ` · first order ${new Date(row.firstOrderAt).toLocaleDateString()}`
                      : row.enabled
                        ? " · no order yet"
                        : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!row.enabled ? (
                    <Button type="button" size="sm" onClick={() => void enableCountry(row.countryIso2)}>
                      <Rocket className="mr-1.5 size-3.5" aria-hidden />
                      Enable checkout
                    </Button>
                  ) : null}
                  {row.enabled && row.pendingNotifyCount > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void notifyCountry(row.countryIso2)}
                    >
                      <Bell className="mr-1.5 size-3.5" aria-hidden />
                      Send launch emails
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  )
}
