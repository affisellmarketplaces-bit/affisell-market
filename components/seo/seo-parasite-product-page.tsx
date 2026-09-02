import Link from "next/link"

import { ProductCrossSocialProof } from "@/components/product/product-cross-social-proof"
import { shopListingPath } from "@/lib/affiliate-routes"
import { commissionnaireCheckoutDisclaimer } from "@/lib/legal/affiliate-commissionnaire-shared"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { SeoParasitePageData } from "@/lib/seo-parasite.server"

type Props = {
  data: SeoParasitePageData
  locale: "fr" | "en"
}

export function SeoParasiteProductPage({ data, locale }: Props) {
  const legalLine = commissionnaireCheckoutDisclaimer(
    { affiliateName: data.shopName, supplierName: data.supplierName },
    locale
  )
  const ctaHref = shopListingPath(data.affiliateSlug, data.listingId)

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">
          {data.shopName}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
          {data.productName}
        </h1>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <p className="text-3xl font-bold tabular-nums text-zinc-950">
            {formatStoreCurrencyFromCents(data.sellingPriceCents)}
          </p>
          {data.marginCents > 0 ? (
            <p className="text-sm font-medium text-violet-800">
              {locale === "fr"
                ? `Marge partenaire ${formatStoreCurrencyFromCents(data.marginCents)}`
                : `Partner margin ${formatStoreCurrencyFromCents(data.marginCents)}`}
            </p>
          ) : null}
        </div>

        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- parasite SEO landing, any image host
          <img
            src={data.imageUrl}
            alt={data.productName}
            className="mt-8 aspect-[4/3] w-full rounded-2xl border border-zinc-200 bg-white object-contain p-4"
          />
        ) : null}

        {data.productDescription ? (
          <p className="mt-8 whitespace-pre-line text-base leading-relaxed text-zinc-700">
            {data.productDescription.slice(0, 1200)}
          </p>
        ) : null}

        <div className="mt-8">
          <ProductCrossSocialProof data={data.socialProof} variant="storefront" />
        </div>

        <div className="mt-10">
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            {locale === "fr" ? "Voir sur la boutique" : "View in shop"}
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-4 py-6 sm:px-6">
        <p className="mx-auto max-w-3xl text-xs leading-relaxed text-zinc-600">{legalLine}</p>
      </footer>
    </div>
  )
}
