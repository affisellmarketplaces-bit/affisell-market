"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Bot, ChevronRight, Package, Sparkles, Users } from "lucide-react"

import { affisellBrand } from "@/lib/affisell-brand"
import {
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
} from "@/lib/marketplace-phase1-fees"
import {
  formatFeeBpsPercent,
  supplierFeeRatesDisplay,
  type SupplierFeeRatesDisplay,
} from "@/lib/marketplace-fee-display"
import type { SupplierFeeUserOverrides } from "@/lib/marketplace-supplier-fee"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** admin = hub auto-fulfill; supplier = balance; product = fiche lien AE; compact = bandeau dashboard */
  variant?: "admin" | "supplier" | "product" | "compact"
  supplierOverrides?: SupplierFeeUserOverrides | null
  /** Met en avant la tuile auto-buy (hub AE ou produit avec auto-buy ON) */
  highlightAutoBuy?: boolean
}

type TileTone = "catalog" | "autobuy" | "affiliate"

const TILE_STYLES: Record<
  TileTone,
  { ring: string; surface: string; iconWrap: string; icon: string; percent: string }
> = {
  catalog: {
    ring: "ring-supplier/40",
    surface:
      "border-supplier/25 bg-gradient-to-br from-supplier-muted/90 via-white/80 to-white/60 dark:from-supplier/15 dark:via-zinc-900/80 dark:to-zinc-950/60",
    iconWrap: "bg-supplier/15 text-supplier dark:bg-supplier/25 dark:text-supplier-light",
    icon: "text-supplier",
    percent: "text-supplier dark:text-supplier-light",
  },
  autobuy: {
    ring: "ring-brand/50",
    surface:
      "border-brand/30 bg-gradient-to-br from-brand-muted/80 via-ai-muted/40 to-white/70 dark:from-brand/20 dark:via-ai/10 dark:to-zinc-950/50",
    iconWrap: "bg-brand/15 text-brand dark:bg-brand/25 dark:text-brand-light",
    icon: "text-brand dark:text-brand-light",
    percent: "bg-[length:200%_auto] bg-clip-text text-transparent bg-gradient-to-r from-brand via-indigo-500 to-cyan-500",
  },
  affiliate: {
    ring: "ring-affiliate/40",
    surface:
      "border-affiliate/25 bg-gradient-to-br from-affiliate-muted/90 via-white/80 to-white/60 dark:from-affiliate/10 dark:via-zinc-900/80 dark:to-zinc-950/60",
    iconWrap: "bg-affiliate/15 text-affiliate dark:bg-affiliate/20 dark:text-affiliate-light",
    icon: "text-affiliate",
    percent: "text-affiliate dark:text-affiliate-light",
  },
}

function FeeSpectrumTile({
  tone,
  icon: Icon,
  title,
  detail,
  percent,
  active,
  badge,
}: {
  tone: TileTone
  icon: LucideIcon
  title: string
  detail: string
  percent: string
  active?: boolean
  badge?: string
}) {
  const s = TILE_STYLES[tone]
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
        s.surface,
        active && cn("ring-2 shadow-lg shadow-brand/15", s.ring, "scale-[1.02]")
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 blur-2xl transition-opacity group-hover:opacity-80 dark:bg-white/5"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            s.iconWrap
          )}
        >
          <Icon className={cn("h-5 w-5", s.icon)} aria-hidden />
        </div>
        {badge ? (
          <span className="rounded-full border border-white/60 bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-300">
            {badge}
          </span>
        ) : null}
      </div>
      <p className={cn("relative mt-4 text-3xl font-black tabular-nums tracking-tight", s.percent)}>
        {percent}
      </p>
      <p className="relative mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
      <p className="relative mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{detail}</p>
    </article>
  )
}

function FeeSettlementFlow() {
  return (
    <div
      className={cn(
        affisellBrand.epoxyChip,
        "flex flex-wrap items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
      )}
    >
      <span className="text-zinc-800 dark:text-zinc-200">Wholesale HT</span>
      <ChevronRight className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
      <span>
        Fee fournisseur <span className="text-supplier">catalogue</span> ou{" "}
        <span className="text-brand">auto-buy</span>
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
      <span>Payout fournisseur</span>
      <span className="mx-1 hidden text-zinc-300 sm:inline" aria-hidden>
        ·
      </span>
      <span className="hidden sm:inline">
        Gains affilié <ChevronRight className="mx-0.5 inline h-3 w-3 text-affiliate/80" aria-hidden />
        fee réseau
      </span>
    </div>
  )
}

function RatesSpectrum({
  rates,
  highlightAutoBuy,
  showAffiliate = true,
}: {
  rates: SupplierFeeRatesDisplay
  highlightAutoBuy?: boolean
  showAffiliate?: boolean
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        showAffiliate ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
      )}
    >
      <FeeSpectrumTile
        tone="catalog"
        icon={Package}
        title="Catalogue natif"
        detail="Vous expédiez — pas d’achat AE Affisell"
        percent={rates.catalogPercent}
        active={highlightAutoBuy === false}
        badge="Ship"
      />
      <FeeSpectrumTile
        tone="autobuy"
        icon={Bot}
        title="Auto-buy Affisell"
        detail="Achat AE, carte Issuing, worker, mapping SKU"
        percent={rates.autoBuyPercent}
        active={highlightAutoBuy === true}
        badge="AE"
      />
      {showAffiliate ? (
        <FeeSpectrumTile
          tone="affiliate"
          icon={Users}
          title="Réseau affilié"
          detail="Commission + markup — base = gains affilié"
          percent={rates.affiliatePercent}
          badge="Net"
        />
      ) : null}
    </div>
  )
}

function FeesShell({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
  footer,
}: {
  id: string
  eyebrow: string
  title: string
  subtitle: ReactNode
  children: ReactNode
  className?: string
  footer?: ReactNode
}) {
  return (
    <section
      className={cn(
        affisellBrand.epoxySurfaceLight,
        "relative overflow-hidden rounded-3xl border border-zinc-200/80 p-5 shadow-lg shadow-brand/5 dark:border-zinc-800/80 md:p-6",
        className
      )}
      aria-labelledby={id}
    >
      <div className={cn(affisellBrand.gradientBar, "absolute inset-x-0 top-0 h-1")} aria-hidden />
      <div className={cn(affisellBrand.headerMesh, "!opacity-40")} aria-hidden />
      <div className="relative space-y-4">
        <header className="space-y-2">
          <div className={cn(affisellBrand.badgeBrand, "w-fit")}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {eyebrow}
          </div>
          <h2 id={id} className="text-balance text-lg font-bold tracking-tight text-zinc-900 dark:text-white md:text-xl">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{subtitle}</p>
        </header>
        {children}
        {footer}
      </div>
    </section>
  )
}

export function AffisellFeeModeBadge({
  usesAffisellAutoBuy,
  className,
}: {
  usesAffisellAutoBuy: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider",
        usesAffisellAutoBuy
          ? "border-brand/35 bg-gradient-to-r from-brand-muted/80 to-ai-muted/50 text-brand dark:text-brand-light"
          : "border-supplier/30 bg-supplier-muted/80 text-supplier dark:text-supplier-light",
        className
      )}
    >
      {usesAffisellAutoBuy ? "auto-buy" : "catalogue"}
    </span>
  )
}

export function AffisellPlatformFeesExplainer({
  className,
  variant = "admin",
  supplierOverrides,
  highlightAutoBuy,
}: Props) {
  const rates = supplierFeeRatesDisplay(supplierOverrides)

  if (variant === "compact") {
    return (
      <div
        className={cn(
          affisellBrand.epoxyChip,
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5",
          className
        )}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
          <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
          Grille wholesale
        </span>
        <span className="hidden h-4 w-px bg-zinc-300 dark:bg-zinc-600 sm:block" aria-hidden />
        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
          <span className="rounded-full bg-supplier-muted/90 px-2 py-0.5 font-semibold text-supplier dark:text-supplier-light">
            {rates.catalogPercent} catalogue
          </span>
          <span className="rounded-full bg-gradient-to-r from-brand-muted/90 to-ai-muted/60 px-2 py-0.5 font-semibold text-brand dark:text-brand-light">
            {rates.autoBuyPercent} auto-buy
          </span>
        </div>
        <Link
          href="/dashboard/supplier/balance"
          className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-brand hover:text-brand-hover dark:text-brand-light"
        >
          Détail
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    )
  }

  if (variant === "product") {
    const activeAutoBuy = highlightAutoBuy === true
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4",
          activeAutoBuy
            ? "border-brand/40 bg-gradient-to-br from-brand-muted/70 via-ai-muted/30 to-white/80 dark:from-brand/20 dark:via-ai/10 dark:to-zinc-950/40"
            : "border-supplier/30 bg-gradient-to-br from-supplier-muted/60 to-white/80 dark:from-supplier/10 dark:to-zinc-950/40",
          className
        )}
      >
        <div className={cn(affisellBrand.gradientBar, "absolute inset-x-0 top-0 h-0.5")} aria-hidden />
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Taux plateforme · wholesale HT
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Mode applicable sur ce produit</p>
            <p
              className={cn(
                "mt-0.5 text-2xl font-black tabular-nums tracking-tight",
                activeAutoBuy ? TILE_STYLES.autobuy.percent : TILE_STYLES.catalog.percent
              )}
            >
              {activeAutoBuy ? rates.autoBuyPercent : rates.catalogPercent}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {activeAutoBuy ? "Auto-buy Affisell (AE)" : "Catalogue — vous expédiez"}
            </p>
          </div>
          <AffisellFeeModeBadge usesAffisellAutoBuy={activeAutoBuy} className="text-[10px] px-2 py-0.5" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Bascule auto-buy : {rates.autoBuyPercent} · expédition manuelle : {rates.catalogPercent} · affiliés :{" "}
          {rates.affiliatePercent} sur leurs gains.
        </p>
      </div>
    )
  }

  if (variant === "supplier") {
    return (
      <FeesShell
        id="affisell-fees-supplier-heading"
        eyebrow="Phase 1 · Smart fees"
        title="Votre grille Affisell"
        subtitle={
          <>
            Deux taux sur votre <span className="font-semibold text-zinc-800 dark:text-zinc-200">wholesale HT</span>{" "}
            selon le canal de fulfillment. Les affiliés ont un frais distinct sur leurs gains (pas sur votre wholesale).
          </>
        }
        className={className}
        footer={
          <>
            {rates.usesLegacyOverride ? (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                Compte legacy : un taux unique s’applique au catalogue et à l’auto-buy.
              </p>
            ) : null}
            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
              Défauts plateforme — catalogue {formatFeeBpsPercent(DEFAULT_SUPPLIER_FEE_BPS_CATALOG)}, auto-buy{" "}
              {formatFeeBpsPercent(DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY)}, affilié{" "}
              {formatFeeBpsPercent(DEFAULT_AFFILIATE_PLATFORM_FEE_BPS)}.
            </p>
          </>
        }
      >
        <RatesSpectrum rates={rates} />
      </FeesShell>
    )
  }

  return (
    <FeesShell
      id="affisell-fees-admin-heading"
      eyebrow="Settlement · Phase 1"
      title="Grille frais intelligente"
      subtitle="Fee fournisseur = % du wholesale HT · Fee affilié = % des gains affilié (hors prix client TTC)."
      className={className}
    >
      <FeeSettlementFlow />
      <RatesSpectrum rates={rates} highlightAutoBuy={highlightAutoBuy ?? true} />
    </FeesShell>
  )
}
