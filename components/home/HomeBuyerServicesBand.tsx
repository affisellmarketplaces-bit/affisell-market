import { getTranslations } from "next-intl/server"

import { HomeBuyerServiceTiles } from "@/components/home/HomeBuyerServiceTiles"
import { homeOrbitalBand } from "@/components/home/home-hero-tokens"
import { loadFeaturedShopsCached } from "@/lib/public-home-cache"

/** Bande violette post-catalogue — 4 services buyer (même style que l’ancien hero strip). */
export async function HomeBuyerServicesBand() {
  const [t, featuredShops] = await Promise.all([
    getTranslations("home.buyerServicesBand"),
    loadFeaturedShopsCached(6),
  ])

  return (
    <section className={homeOrbitalBand} aria-labelledby="home-buyer-services-band-heading">
      <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.04]" aria-hidden />
      <div
        className="pointer-events-none absolute -right-10 top-0 size-48 rounded-full bg-fuchsia-500/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 size-40 rounded-full bg-sky-500/15 blur-3xl"
        aria-hidden
      />
      <header className="relative mb-5 text-center sm:mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/90">
          {t("eyebrow")}
        </p>
        <h2
          id="home-buyer-services-band-heading"
          className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl"
        >
          {t("title")}
        </h2>
        <p className="mx-auto mt-1.5 max-w-lg text-sm text-violet-100/85">{t("subtitle")}</p>
      </header>
      <div className="relative">
        <HomeBuyerServiceTiles featuredShops={featuredShops} />
      </div>
    </section>
  )
}
