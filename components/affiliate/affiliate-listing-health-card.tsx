import Link from "next/link"
import { AlertTriangle, Eye, ShieldCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import type { ListingHealthRow } from "@/lib/reseller-copilot.server"
import type { ListingHealthIssue } from "@/lib/reseller-opportunity-score"
import { cn } from "@/lib/utils"

const MAX_ROWS = 5

type Props = {
  listings: ListingHealthRow[]
  className?: string
}

const ISSUE_KEYS: Record<ListingHealthIssue, string> = {
  supplier_price_at_or_above_selling: "issueSupplierPrice",
  net_insufficient: "issueNetInsufficient",
  net_thin: "issueNetThin",
  refund_rate_rising: "issueRefundRising",
}

function euros(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

/**
 * Listings that no longer earn what they should, at the reseller's own price (server-rendered, no hydration).
 * Shows nothing when every listing is healthy — no noise.
 */
export function AffiliateListingHealthCard({ listings, className }: Props) {
  const t = useTranslations("affiliate.listingHealth")
  const locale = useLocale()
  const flagged = listings.filter((l) => l.status !== "ok")
  if (flagged.length === 0) return null
  const actionCount = flagged.filter((l) => l.status === "action").length

  return (
    <section
      className={cn(
        "rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 sm:p-5",
        className,
      )}
      data-testid="affiliate-listing-health"
      aria-labelledby="affiliate-listing-health-heading"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        <ShieldCheck className="size-4" aria-hidden />
        {t("eyebrow")}
      </p>
      <h2 id="affiliate-listing-health-heading" className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {actionCount > 0 ? t("titleAction", { count: actionCount }) : t("titleWatch", { count: flagged.length })}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("hint")}</p>

      <ul className="mt-4 space-y-2">
        {flagged.slice(0, MAX_ROWS).map((l) => (
          <li
            key={l.listingId}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/80"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {l.status === "action" ? (
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-label={t("statusAction")} />
                ) : (
                  <Eye className="size-4 shrink-0 text-zinc-500" aria-label={t("statusWatch")} />
                )}
                <span className="truncate">{l.name}</span>
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {l.issues.map((issue) => (
                  <li
                    key={issue}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                  >
                    {t(ISSUE_KEYS[issue])}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right text-xs text-zinc-600 dark:text-zinc-400">
              <p>
                {t("expectedNet")}{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {euros(l.guard.expectedNetCents, locale)}
                </span>
              </p>
              <p>
                {t("prices", {
                  selling: euros(l.sellingPriceCents, locale),
                  supplier: euros(l.supplierPriceCents, locale),
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{t("estimateNote")}</p>
        <Link
          href="/dashboard/affiliate/products"
          className="text-sm font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        >
          {t("review")}
        </Link>
      </div>
    </section>
  )
}
