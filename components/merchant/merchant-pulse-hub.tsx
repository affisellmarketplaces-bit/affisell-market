import Link from "next/link"
import type { DailySpark, PulseBandRow } from "@/lib/merchant-earnings-pulse"
import { affisellBrand } from "@/lib/affisell-brand"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"
import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { ArrowUpRight, Landmark, Sparkles, TrendingUp, Wallet } from "lucide-react"

type LedgerMini = {
  id: string
  amountCents: number
  entryType: string
  note: string | null
  createdAt: Date
}

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  eyebrow: string
  title: string
  description: string
  paidOutLabel: string
  paidOutCents: number
  bands: PulseBandRow[]
  sparkline: DailySpark[]
  recentLedger: LedgerMini[]
  backHref: string
}

function SparkRibbon({ data }: { data: DailySpark[] }) {
  const maxUnits = Math.max(1, ...data.map((d) => d.units))
  const maxCents = Math.max(1, ...data.map((d) => d.cents))
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Momentum
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Last 14 days · units & earnings</p>
        </div>
      </div>
      <div className="flex h-32 items-end gap-1 sm:gap-1.5">
        {data.map((d) => {
          const uh = (d.units / maxUnits) * 100
          const ch = (d.cents / maxCents) * 100
          return (
            <div
              key={d.day}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${d.day} · ${d.units} units · ${formatStoreCurrencyFromCents(d.cents)}`}
            >
              <div className="flex h-28 w-full flex-col justify-end gap-0.5">
                <div
                  className={cn(
                    "w-full rounded-t-md bg-gradient-to-t from-brand via-violet-400 to-ai opacity-90 transition group-hover:opacity-100"
                  )}
                  style={{ height: `${Math.max(uh, 4)}%`, minHeight: d.units ? 8 : 2 }}
                />
                <div
                  className="w-full rounded-t-sm bg-buyer/35 dark:bg-buyer/25"
                  style={{ height: `${Math.max(ch * 0.35, 2)}%`, maxHeight: "28%" }}
                />
              </div>
              <span className="hidden truncate text-[9px] font-medium text-zinc-400 sm:block">
                {d.day.slice(5)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Taller bars: units sold · Accent: relative revenue pulse (same scale, damped)
      </p>
    </div>
  )
}

export function MerchantPulseHub({
  role,
  eyebrow,
  title,
  description,
  paidOutLabel,
  paidOutCents,
  bands,
  sparkline,
  recentLedger,
  backHref,
}: Props) {
  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-8 py-8 md:py-10">
        <BentoCard className="relative overflow-hidden border-brand/20 bg-gradient-to-br from-white/95 via-brand-muted/40 to-ai-muted/35 p-6 shadow-lg shadow-brand/10 dark:from-zinc-950/95 dark:via-brand/10 dark:to-ai/5 sm:p-8">
          <div className={cn(affisellBrand.headerMesh, "!opacity-60")} aria-hidden />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className={cn(affisellBrand.badgeBrand, "w-fit")}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {eyebrow}
              </div>
              <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-4xl">
                {title}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{description}</p>
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-hover hover:underline dark:text-brand-light"
              >
                ← Back to dashboard
              </Link>
            </div>
            <div className="flex w-full max-w-sm shrink-0 flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 p-5 shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/75">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <Wallet className="h-4 w-4 text-brand" aria-hidden />
                {paidOutLabel}
              </div>
              <p className="text-3xl font-black tabular-nums tracking-tight text-zinc-900 dark:text-white">
                {formatStoreCurrencyFromCents(paidOutCents)}
              </p>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Net of recorded payouts and any clawbacks — see activity below.
              </p>
              {role === "AFFILIATE" ? (
                <Link
                  href="/dashboard/affiliate/catalog"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ai hover:underline"
                >
                  Drive more sales <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  href="/dashboard/affiliate/catalog"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-supplier hover:underline"
                >
                  Browse demand <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </BentoCard>

        <div className="grid gap-4 md:grid-cols-3">
          {bands.map((b) => (
            <BentoCard
              key={b.band}
              className="border-zinc-200/80 p-5 dark:border-zinc-800/80"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {b.label}
                </p>
                <TrendingUp className="h-4 w-4 text-brand/80" aria-hidden />
              </div>
              <p className="mt-3 text-2xl font-black tabular-nums text-zinc-900 dark:text-white">
                {b.unitsSold}{" "}
                <span className="text-base font-semibold text-zinc-500 dark:text-zinc-400">units</span>
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-brand dark:text-brand-light">
                {formatStoreCurrencyFromCents(b.grossRoleCents)}
              </p>
              {role === "AFFILIATE" &&
              typeof b.commissionCents === "number" &&
              typeof b.markupCents === "number" ? (
                <div className="mt-4 space-y-2">
                  <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    {b.grossRoleCents > 0 ? (
                      <>
                        <span
                          className="h-full bg-ai"
                          style={{ width: `${(b.commissionCents / b.grossRoleCents) * 100}%` }}
                        />
                        <span
                          className="h-full bg-brand"
                          style={{ width: `${(b.markupCents / b.grossRoleCents) * 100}%` }}
                        />
                      </>
                    ) : null}
                  </div>
                  <ul className="grid grid-cols-2 gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <li className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-ai" />
                      Commission {formatStoreCurrencyFromCents(b.commissionCents)}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-brand" />
                      Markup {formatStoreCurrencyFromCents(b.markupCents)}
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Wholesale value of units sold in this window (before platform timing on payouts).
                </p>
              )}
            </BentoCard>
          ))}
        </div>

        <BentoCard className="p-6 md:p-8">
          <SparkRibbon data={sparkline} />
        </BentoCard>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-brand" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
              Payout ledger
            </h2>
          </div>
          {recentLedger.length === 0 ? (
            <BentoCard className="border-dashed py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No payout entries yet — they appear once orders clear the delivery confirmation window.
            </BentoCard>
          ) : (
            <div className="grid gap-3">
              {recentLedger.map((e) => {
                const isClaw = e.entryType === "CLAWBACK"
                return (
                  <BentoCard
                    key={e.id}
                    className={cn(
                      "flex flex-col gap-2 border-zinc-200/90 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800",
                      isClaw && "border-rose-200/80 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {e.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {e.entryType === "CLAWBACK" ? "Adjustment" : "Payout"}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-right text-lg font-black tabular-nums",
                        isClaw ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"
                      )}
                    >
                      {isClaw ? "−" : "+"}
                      {formatStoreCurrencyFromCents(e.amountCents)}
                    </p>
                  </BentoCard>
                )
              })}
            </div>
          )}
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
