"use client"

import { useState, useTransition } from "react"
import { BarChart3, Bell, Download, Eye, Globe2, GraduationCap, Mail, RefreshCw, Rocket, Zap } from "lucide-react"
import { toast } from "sonner"

import type { AdminExpansionOverview } from "@/lib/admin/admin-expansion-types"
import { EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT } from "@/lib/expansion/compute-country-bounce-rate"
import { expansionCountryLabel } from "@/lib/expansion/expansion-country-label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Props = {
  initial: AdminExpansionOverview
  metabaseExpansionEmbedUrl: string | null
  metabaseExpansionBounceEmbedUrl: string | null
}

export function AdminExpansionConsole({
  initial,
  metabaseExpansionEmbedUrl,
  metabaseExpansionBounceEmbedUrl,
}: Props) {
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

  async function graduateCountry(countryIso2: string) {
    const res = await fetch("/api/admin/expansion/graduate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryIso2 }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string; alreadyGraduated?: boolean }
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Graduate failed")
      return
    }
    toast.success(data.alreadyGraduated ? `${countryIso2} already graduated` : `${countryIso2} graduated to permanent checkout`)
    refresh()
  }

  async function graduateNotifyCountry(countryIso2: string) {
    const res = await fetch("/api/admin/expansion/graduate-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryIso2 }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      sent?: number
      failed?: number
      recipientCount?: number
      error?: string
    }
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Graduation emails failed")
      return
    }
    toast.success(
      `Graduation emails · ${data.sent ?? 0} sent${data.failed ? ` · ${data.failed} failed` : ""} · ${data.recipientCount ?? 0} recipients`
    )
    refresh()
  }

  async function unsuppressCountry(countryIso2: string) {
    const res = await fetch("/api/admin/expansion/unsuppress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryIso2 }),
    })
    const data = (await res.json()) as { ok?: boolean; unsuppressed?: number; error?: string }
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Force retry failed")
      return
    }
    toast.success(`Re-queued ${data.unsuppressed ?? 0} suppressed email(s) for ${countryIso2}`)
    refresh()
  }

  async function runPilot(rank?: number) {
    const res = await fetch("/api/admin/expansion/pilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rank ? { rank } : {}),
    })
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

  const { nextPilot, funnel } = overview

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Expansion ROW</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Country-by-country checkout
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Funnel waitlist → notify → first order. Pilot the next country from demand, then track conversion here
            or in Metabase (`[expansion-rollout]`, `[launch-waitlist]`).
            {overview.autoPilotEnabled ? " Auto-pilot ON — next country opens after first order." : null}
            {overview.graduatedCount > 0
              ? ` ${overview.graduatedCount} in permanent Stripe base.`
              : null}
            {overview.funnel.graduationsWithBuyerEmail > 0
              ? ` ${overview.funnel.graduationsWithBuyerEmail} graduation email batch(es) sent (Metabase: graduationEmailSentAt).`
              : null}
            {overview.rolloutHealth.stalledCount > 0
              ? ` ${overview.rolloutHealth.stalledCount} rollout(s) stalled 7d+ without order.`
              : null}
            {overview.rolloutHealth.graduationEmailStallCount > 0
              ? ` ${overview.rolloutHealth.graduationEmailStallCount} graduation email(s) stalled 48h+ (${overview.rolloutHealth.graduationEmailStallCountries.join(", ")}).`
              : null}
            {overview.emailBounces.bouncesThisMonth > 0
              ? ` ${overview.emailBounces.bouncesThisMonth} expansion email bounce(s) this month.`
              : null}
            {overview.emailBounces.launchRetriesPending > 0
              ? ` ${overview.emailBounces.launchRetriesPending} launch email(s) queued for auto-retry.`
              : null}
            {overview.emailBounces.launchSuppressedTotal > 0
              ? ` ${overview.emailBounces.launchSuppressedTotal} launch email(s) permanently suppressed after 2nd bounce.`
              : null}
            {overview.emailBounces.suppressedStalePendingPurge > 0
              ? ` ${overview.emailBounces.suppressedStalePendingPurge} suppressed row(s) eligible for 90d auto-purge.`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={refresh}>
            Refresh
          </Button>
          {overview.emailBounces.launchSuppressedTotal > 0 ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href="/api/admin/expansion/suppressed-export">
                <Download className="mr-1.5 size-3.5" aria-hidden />
                Export suppressed CSV
              </a>
            </Button>
          ) : null}
          {nextPilot ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => void runPilot(nextPilot.rank)}>
              <Zap className="mr-1.5 size-3.5" aria-hidden />
              Pilot {nextPilot.countryIso2} ({nextPilot.waitlistCount})
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Live checkout countries" value={overview.liveCheckoutCount} />
        <MetricCard label="ROW rollouts enabled" value={overview.rolloutCount} />
        <MetricCard
          label="Graduated (permanent)"
          value={overview.graduatedCount}
          hint={overview.graduatedThisMonth > 0 ? `+${overview.graduatedThisMonth} this month` : undefined}
        />
        <MetricCard
          label="Graduated this month"
          value={overview.graduatedThisMonth}
          hint={
            overview.graduatedThisMonthCountries.length > 0
              ? overview.graduatedThisMonthCountries
                  .map((row) => row.countryIso2.toUpperCase())
                  .join(", ")
              : undefined
          }
        />
        <MetricCard
          label="Email bounces (month)"
          value={overview.emailBounces.bouncesThisMonth}
          hint={
            overview.emailBounces.launchRetriesPending > 0
              ? `${overview.emailBounces.launchRetriesPending} retry queued`
              : overview.emailBounces.launchSuppressedTotal > 0
                ? `${overview.emailBounces.launchSuppressedTotal} suppressed`
                : overview.emailBounces.complaintsThisMonth > 0
                  ? `${overview.emailBounces.complaintsThisMonth} complaint(s)`
                  : undefined
          }
        />
        <MetricCard label="Waitlist signups" value={overview.totalWaitlist} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FunnelCard label="Notified" value={funnel.notifiedTotal} hint={`${funnel.notifyRatePct}% of waitlist`} />
        <FunnelCard label="J+2 follow-up" value={funnel.followUpTotal} hint="Re-engagement sent" />
        <FunnelCard
          label="Rollouts w/ order"
          value={funnel.rolloutsWithFirstOrder}
          hint={`${funnel.firstOrderRatePct}% of enabled`}
        />
        <FunnelCard
          label="Graduation emails"
          value={funnel.graduationsWithBuyerEmail}
          hint={
            funnel.graduationEmailsPending > 0
              ? `${funnel.graduationEmailsPending} pending send`
              : "Buyer re-engagement sent"
          }
        />
      </div>

      {metabaseExpansionEmbedUrl ? (
        <section className="mb-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
            <BarChart3 className="size-3.5 text-violet-600" aria-hidden />
            Metabase · expansion funnel
          </div>
          <iframe
            title="Metabase expansion dashboard"
            src={metabaseExpansionEmbedUrl}
            className="h-[420px] w-full border-0 bg-zinc-50 dark:bg-zinc-950"
            loading="lazy"
          />
        </section>
      ) : null}

      {metabaseExpansionBounceEmbedUrl ? (
        <section className="mb-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
            <BarChart3 className="size-3.5 text-orange-600" aria-hidden />
            Metabase · expansion email bounces
          </div>
          <iframe
            title="Metabase expansion bounce dashboard"
            src={metabaseExpansionBounceEmbedUrl}
            className="h-[320px] w-full border-0 bg-zinc-50 dark:bg-zinc-950"
            loading="lazy"
          />
        </section>
      ) : null}

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
                      row.graduatedAt ? (
                        <Badge className="bg-violet-600 hover:bg-violet-600">Graduated</Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Checkout on</Badge>
                      )
                    ) : (
                      <Badge variant="outline">Waiting</Badge>
                    )}
                    {row.launchBounceRetriesPending > 0 ? (
                      <Badge className="bg-orange-600 hover:bg-orange-600">
                        Bounce retry ({row.launchBounceRetriesPending})
                      </Badge>
                    ) : null}
                    {row.launchBounceSuppressed > 0 ? (
                      <Badge variant="destructive">
                        Bounced ({row.launchBounceSuppressed})
                      </Badge>
                    ) : null}
                    {row.launchBounceRatePct > EXPANSION_BOUNCE_RATE_ALERT_THRESHOLD_PCT ? (
                      <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
                        {row.launchBounceRatePct}% bounce
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {row.waitlistCount} signup{row.waitlistCount === 1 ? "" : "s"}
                    {row.pendingNotifyCount > 0 ? ` · ${row.pendingNotifyCount} pending email` : ""}
                    {row.launchBounceRetriesPending > 0
                      ? ` · ${row.launchBounceRetriesPending} bounce retry`
                      : ""}
                    {row.launchBounceSuppressed > 0
                      ? ` · ${row.launchBounceSuppressed} suppressed`
                      : ""}
                    {row.launchEmailSentAt ? ` · last notify ${new Date(row.launchEmailSentAt).toLocaleDateString()}` : ""}
                    {row.firstOrderAt
                      ? ` · first order ${new Date(row.firstOrderAt).toLocaleDateString()}`
                      : row.enabled
                        ? " · no order yet"
                        : ""}
                    {row.graduatedAt ? ` · graduated ${new Date(row.graduatedAt).toLocaleDateString()}` : ""}
                    {row.graduationEmailSentAt
                      ? ` · graduation emails ${new Date(row.graduationEmailSentAt).toLocaleDateString()}`
                      : row.graduatedAt
                        ? " · graduation emails pending"
                        : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-violet-600/90 dark:text-violet-400/90">
                    Funnel · notified {row.funnel.notifiedCount} ({row.funnel.notifyRatePct}%) · follow-up{" "}
                    {row.funnel.followUpCount} · orders {row.funnel.paidOrdersSinceOpen} (
                    {row.funnel.orderRatePct}% of notified)
                    {row.launchBounceRatePct > 0 ? ` · bounce ${row.launchBounceRatePct}%` : ""}
                    {row.launchEmailsDeliveredThisMonth > 0
                      ? ` · delivered ${row.launchEmailsDeliveredThisMonth} (${row.launchDeliveryRatePct}%)`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.enabled ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a
                        href={`/api/admin/expansion/launch-email-preview?countryIso2=${encodeURIComponent(row.countryIso2)}&locale=en`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Eye className="mr-1.5 size-3.5" aria-hidden />
                        Preview launch email
                      </a>
                    </Button>
                  ) : null}
                  {!row.enabled ? (
                    <Button type="button" size="sm" onClick={() => void enableCountry(row.countryIso2)}>
                      <Rocket className="mr-1.5 size-3.5" aria-hidden />
                      Enable checkout
                    </Button>
                  ) : null}
                  {row.enabled && row.firstOrderAt && !row.graduatedAt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void graduateCountry(row.countryIso2)}
                    >
                      <GraduationCap className="mr-1.5 size-3.5" aria-hidden />
                      Graduate
                    </Button>
                  ) : null}
                  {row.graduatedAt && !row.graduationEmailSentAt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void graduateNotifyCountry(row.countryIso2)}
                    >
                      <Mail className="mr-1.5 size-3.5" aria-hidden />
                      Send graduation emails
                    </Button>
                  ) : null}
                  {row.launchBounceSuppressed > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void unsuppressCountry(row.countryIso2)}
                    >
                      <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                      Force retry
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

function MetricCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-violet-600 dark:text-violet-400">{hint}</p> : null}
    </div>
  )
}

function FunnelCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-violet-200/60 bg-violet-50/50 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-950/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/80 dark:text-violet-300/80">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-[11px] text-zinc-500">{hint}</p>
    </div>
  )
}
