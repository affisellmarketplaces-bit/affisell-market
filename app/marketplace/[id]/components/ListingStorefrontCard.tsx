"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { StorefrontInfo } from "../listing-detail-types"
import { t } from "../listing-detail-utils"

type Props = {
  audience: "customer" | "merchant"
  storefront: StorefrontInfo | null
  partnerLabel?: string
  productT: {
    curatedByPartner: string
    verifiedPartnerStorefront: string
    byStore: string
  }
}

export function ListingStorefrontCard({ audience, storefront, partnerLabel, productT }: Props) {
  if (storefront) {
    return (
      <Link
        href={`/store/${encodeURIComponent(storefront.slug)}`}
        className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 transition hover:border-violet-200 hover:bg-violet-50/40 max-lg:mx-0 max-lg:mt-2 lg:rounded-2xl lg:p-4 dark:border-zinc-800 dark:hover:border-violet-900/50 dark:hover:bg-violet-950/20"
      >
        {storefront.aiAvatarUrl || storefront.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- storefront logo / AI avatar URLs */
          <img
            src={storefront.aiAvatarUrl || storefront.logoUrl || ""}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-zinc-100 bg-white object-cover object-center p-0.5 dark:border-zinc-700"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-teal-50 text-lg font-bold text-violet-800 dark:from-violet-950 dark:to-teal-950 dark:text-violet-200">
            {storefront.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {productT.curatedByPartner}
          </p>
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{storefront.name}</p>
          {storefront.showTrustedSoldBy ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{productT.verifiedPartnerStorefront}</p>
          ) : null}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
      </Link>
    )
  }

  if (audience === "merchant") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t(productT.byStore, { store: partnerLabel || productT.curatedByPartner })}
      </p>
    )
  }

  return null
}
