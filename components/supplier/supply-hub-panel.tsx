import Link from "next/link"
import { getTranslations } from "next-intl/server"
import {
  ArrowRight,
  Box,
  Factory,
  Layers,
  Package,
  ShoppingCart,
  Sparkles,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type {
  SupplyCapabilityKey,
  SupplyCapabilityState,
  SupplyConnectorUiStatus,
  SupplyHubSnapshot,
} from "@/lib/supplier/supply-hub-shared"
import { cn } from "@/lib/utils"

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  native: Package,
  aliexpress: ShoppingCart,
  alibaba1688: Warehouse,
  factory: Factory,
  bigbuy: Box,
  cj: Layers,
  amazon: Sparkles,
  manual: Box,
}

const STATUS_STYLES: Record<
  SupplyConnectorUiStatus,
  { ring: string; badge: string; dot: string }
> = {
  live: {
    ring: "border-emerald-500/35 shadow-[0_0_24px_-8px_rgba(16,185,129,0.45)]",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    dot: "bg-emerald-400",
  },
  connected: {
    ring: "border-violet-500/35 shadow-[0_0_24px_-8px_rgba(139,92,246,0.45)]",
    badge: "bg-violet-500/15 text-violet-300 border-violet-400/30",
    dot: "bg-violet-400",
  },
  setup: {
    ring: "border-amber-500/30 shadow-[0_0_20px_-10px_rgba(245,158,11,0.35)]",
    badge: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    dot: "bg-amber-400",
  },
  native: {
    ring: "border-sky-500/35 shadow-[0_0_24px_-8px_rgba(56,189,248,0.4)]",
    badge: "bg-sky-500/15 text-sky-200 border-sky-400/30",
    dot: "bg-sky-400",
  },
  roadmap: {
    ring: "border-zinc-700/80",
    badge: "bg-zinc-800/80 text-zinc-500 border-zinc-600/50",
    dot: "bg-zinc-600",
  },
}

const CAP_KEYS: SupplyCapabilityKey[] = ["catalog", "orders", "negotiate", "packaging"]

type Props = {
  snapshot: SupplyHubSnapshot
}

export async function SupplyHubPanel({ snapshot }: Props) {
  const t = await getTranslations("supplierDashboard.supplyHub")

  return (
    <div className="space-y-8">
      <section
        className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-zinc-950 via-violet-950/90 to-zinc-900 p-6 text-white sm:p-8"
        aria-labelledby="supply-hub-hero"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/25 blur-3xl"
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300/90">
          {t("eyebrow")}
        </p>
        <h2 id="supply-hub-hero" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{t("subtitle")}</p>
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:max-w-lg">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("totals.skus")}
            </dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums text-white">
              {snapshot.totals.catalogSkus}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("totals.autoBuy")}
            </dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums text-violet-300">
              {snapshot.totals.autoBuySkus}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <dt className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("totals.sync")}
            </dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums text-white">
              {snapshot.totals.platformSyncEnabled}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="supply-connectors-heading">
        <h3
          id="supply-connectors-heading"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
        >
          {t("connectorsTitle")}
        </h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {snapshot.connectors.map((c) => {
            const Icon = CHANNEL_ICONS[c.labelKey] ?? Layers
            const styles = STATUS_STYLES[c.uiStatus]
            const name = t(`channels.${c.labelKey}.name`)
            const statusLabel = t(`status.${c.uiStatus}`)
            const phaseLabel = t("phase", { n: c.phase })

            return (
              <li
                key={c.channelType}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-zinc-950 p-4 text-white transition",
                  styles.ring
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Icon className="h-5 w-5 text-violet-300" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight">{name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                        {phaseLabel}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      styles.badge
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} aria-hidden />
                    {statusLabel}
                  </span>
                </div>

                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("capabilitiesAria")}>
                  {CAP_KEYS.map((cap) => (
                    <CapabilityPill
                      key={cap}
                      label={t(`capabilities.${cap}`)}
                      state={c.capabilities[cap]}
                      stateLabel={t(`capState.${c.capabilities[cap]}`)}
                    />
                  ))}
                </ul>

                {c.stats?.linkedSkus != null || c.stats?.autoBuySkus != null ? (
                  <p className="mt-3 text-xs tabular-nums text-zinc-500">
                    {c.stats.linkedSkus != null
                      ? t("stats.linked", { count: c.stats.linkedSkus })
                      : null}
                    {c.stats.autoBuySkus != null && c.stats.autoBuySkus > 0
                      ? ` · ${t("stats.autoBuy", { count: c.stats.autoBuySkus })}`
                      : null}
                  </p>
                ) : null}

                {c.hintKey ? (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    {t(`hints.${c.hintKey}`)}
                  </p>
                ) : null}

                {c.href ? (
                  <Link
                    href={c.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 transition hover:text-violet-200"
                  >
                    {t("openChannel")}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{t("footerNote")}</p>
    </div>
  )
}

function CapabilityPill({
  label,
  state,
  stateLabel,
}: {
  label: string
  state: SupplyCapabilityState
  stateLabel: string
}) {
  const tone =
    state === "live"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : state === "beta"
        ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
        : state === "soon"
          ? "border-zinc-600 bg-zinc-800/60 text-zinc-500"
          : "border-zinc-700/50 bg-zinc-900/60 text-zinc-600"

  return (
    <li
      className={cn(
        "rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        tone
      )}
      title={stateLabel}
    >
      {label}
    </li>
  )
}
