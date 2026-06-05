import { getTranslations } from "next-intl/server"

import { HomeBuyerServiceTiles } from "@/components/home/HomeBuyerServiceTiles"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-shared"

type Props = {
  featuredShops: PublicShopDirectoryEntry[]
}

/** @deprecated Préférer HomeBuyerServicesBand — strip embarquée hero (legacy). */
export async function HomeBuyerSmartStrip({ featuredShops }: Props) {
  const t = await getTranslations("home.buyerServices")

  return (
    <div
      className="relative mt-10 border-t border-white/20 pt-8 sm:mt-12 sm:pt-10"
      aria-labelledby="buyer-smart-strip-heading"
    >
      <p
        id="buyer-smart-strip-heading"
        className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-100/90"
      >
        {t("sectionBuyer")}
      </p>
      <HomeBuyerServiceTiles featuredShops={featuredShops} />
    </div>
  )
}
