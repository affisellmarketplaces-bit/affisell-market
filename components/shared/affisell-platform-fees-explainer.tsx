import {
  DEFAULT_AFFILIATE_PLATFORM_FEE_BPS,
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
} from "@/lib/marketplace-phase1-fees"
import Link from "next/link"

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
  /** Highlight auto-buy row when configuring AE on a product */
  highlightAutoBuy?: boolean
}

function FeeRow({
  label,
  detail,
  percent,
  emphasized,
}: {
  label: string
  detail: string
  percent: string
  emphasized?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2",
        emphasized
          ? "border-violet-300 bg-violet-100/80 dark:border-violet-700 dark:bg-violet-950/50"
          : "border-zinc-200/80 bg-white/60 dark:border-zinc-700 dark:bg-zinc-900/40"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-violet-800 dark:text-violet-200">
        {percent}
      </p>
    </div>
  )
}

function RatesGrid({ rates, highlightAutoBuy }: { rates: SupplierFeeRatesDisplay; highlightAutoBuy?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-1">
      <FeeRow
        label="Catalogue natif"
        detail="Vous expédiez — pas d’achat AE Affisell"
        percent={rates.catalogPercent}
      />
      <FeeRow
        label="Auto-buy Affisell"
        detail="Achat AE, carte, worker, mapping SKU"
        percent={rates.autoBuyPercent}
        emphasized={highlightAutoBuy}
      />
      <FeeRow
        label="Gains affilié (réseau)"
        detail="Commission + markup affilié sur la commande"
        percent={rates.affiliatePercent}
      />
    </div>
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
      <p
        className={cn(
          "rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
          className
        )}
      >
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Frais Affisell (wholesale HT)</span>
        {" · "}
        {rates.catalogPercent} catalogue
        {" · "}
        {rates.autoBuyPercent} auto-buy AE
        {" · "}
        <Link
          href="/dashboard/supplier/balance"
          className="font-medium text-violet-700 underline underline-offset-2 dark:text-violet-300"
        >
          détail & historique
        </Link>
      </p>
    )
  }

  if (variant === "product") {
    return (
      <div
        className={cn(
          "rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/25",
          className
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
          Frais plateforme fournisseur (wholesale HT)
        </p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Avec auto-buy activé sur ce produit, chaque vente utilise le taux{" "}
          <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{rates.autoBuyPercent}</strong>{" "}
          (sinon {rates.catalogPercent} si vous expédiez sans auto-buy).
        </p>
      </div>
    )
  }

  if (variant === "supplier") {
    return (
      <section
        className={cn(
          "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
          className
        )}
        aria-labelledby="affisell-fees-supplier-heading"
      >
        <h2
          id="affisell-fees-supplier-heading"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Frais Affisell sur vos ventes
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Deux taux sur votre <span className="font-medium">wholesale HT</span>, selon que vous utilisez
          l’auto-buy Affisell ou votre propre expédition. Les affiliés ont un frais séparé sur leurs gains.
        </p>
        {rates.usesLegacyOverride ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            Compte avec taux personnalisé unique (legacy) : catalogue et auto-buy partagent le même %.
          </p>
        ) : null}
        <div className="mt-4">
          <RatesGrid rates={rates} />
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">
          Défauts plateforme : catalogue {formatFeeBpsPercent(DEFAULT_SUPPLIER_FEE_BPS_CATALOG)}, auto-buy{" "}
          {formatFeeBpsPercent(DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY)}, affilié{" "}
          {formatFeeBpsPercent(DEFAULT_AFFILIATE_PLATFORM_FEE_BPS)}.
        </p>
      </section>
    )
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
      aria-labelledby="affisell-fees-admin-heading"
    >
      <h2 id="affisell-fees-admin-heading" className="text-sm font-semibold text-zinc-900 dark:text-white">
        Grille frais Affisell (Phase 1)
      </h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Fee fournisseur = % du wholesale · Fee affilié = % des gains affilié (pas du HT client).
      </p>
      <div className="mt-3">
        <RatesGrid rates={rates} highlightAutoBuy={highlightAutoBuy} />
      </div>
    </section>
  )
}
