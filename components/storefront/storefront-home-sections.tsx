import Link from "next/link"
import { BadgeCheck, ShieldCheck, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { ProductGrid } from "@/components/shop/ProductGrid"
import { StorefrontBestsellersSection } from "@/components/storefront/storefront-bestsellers-section"
import { StorefrontDedicatedHero } from "@/components/storefront/storefront-dedicated-hero"
import { StorefrontNewsletterSection } from "@/components/storefront/storefront-newsletter-section"
import { StorefrontSocialProofSection } from "@/components/storefront/storefront-social-proof-section"
import { StorefrontTaglineBand } from "@/components/storefront/storefront-tagline-band"
import type { ShopProductCard, ShopStoreSummary } from "@/lib/shop-storefront-shared"
import {
  getEnabledHomepageSections,
  sectionCopyString,
} from "@/lib/storefront-sections-shared"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import { cn } from "@/lib/utils"

type Props = {
  store: ShopStoreSummary
  trust: StorefrontTrustSnapshot | null
  slug: string
  products: ShopProductCard[]
  catalogProducts: ShopProductCard[]
  activeCategoryLabel?: string | null
  isDedicatedHost: boolean
}

export async function StorefrontHomeSections({
  store,
  trust,
  slug,
  products,
  catalogProducts,
  activeCategoryLabel,
  isDedicatedHost,
}: Props) {
  const sections = getEnabledHomepageSections(store.theme.homepageSections ?? [])
  const t = await getTranslations("storefront.homeSections")

  if (sections.length === 0) return null

  return (
    <>
      {sections.map((section) => {
        const content = section.content

        switch (section.type) {
          case "hero":
            return <StorefrontHeroBlock key="hero" store={store} />
          case "story": {
            const body =
              sectionCopyString(content, "body", "") || store.description?.trim() || ""
            if (!body) return null
            return (
              <section
                key="story"
                className="border-b border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {sectionCopyString(content, "eyebrow", t("storyEyebrow"))}
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {body}
                  </p>
                </div>
              </section>
            )
          }
          case "bestsellers":
            return (
              <StorefrontBestsellersSection
                key="bestsellers"
                storeSlug={slug}
                products={catalogProducts}
                content={content}
                dedicatedHost={isDedicatedHost}
                labels={{
                  eyebrow: t("bestsellersEyebrow"),
                  title: t("bestsellersTitle"),
                  hint: t("bestsellersHint"),
                }}
              />
            )
          case "products":
            return (
              <div key="products" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                <ProductGrid
                  storeSlug={slug}
                  products={products}
                  mode="customer"
                  gridDensity={store.theme.gridDensity}
                  layout={store.theme.layout}
                  dedicatedHost={isDedicatedHost}
                  activeCategoryLabel={activeCategoryLabel ?? null}
                />
              </div>
            )
          case "social-proof":
            return (
              <StorefrontSocialProofSection
                key="social-proof"
                content={content}
                labels={{
                  quote: t("socialProofQuote"),
                  author: t("socialProofAuthor"),
                  stat: t("socialProofStat"),
                }}
              />
            )
          case "trust":
            return trust ? (
              <section
                key="trust"
                className="border-y border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              >
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                        {sectionCopyString(content, "title", t("trustTitle"))}
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-900/80 dark:text-emerald-100/80">
                        {sectionCopyString(
                          content,
                          "body",
                          t("trustBody", { code: trust.partnerListingCode })
                        )}
                      </p>
                    </div>
                  </div>
                  {trust.merchantVerified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      <BadgeCheck className="size-3.5" aria-hidden />
                      {t("verified")}
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null
          case "newsletter":
            return (
              <StorefrontNewsletterSection
                key="newsletter"
                storeSlug={slug}
                content={content}
                accent={store.theme.accent}
              />
            )
          case "cta": {
            const href = sectionCopyString(content, "buttonHref", "/discover")
            return (
              <section key="cta" className="border-t border-zinc-200/80 dark:border-zinc-800">
                <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
                  <div
                    className={cn(
                      "overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-600/10 via-white to-indigo-500/10 p-6 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-indigo-950/30 sm:p-8"
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          <Sparkles className="size-4" aria-hidden />
                          {sectionCopyString(content, "eyebrow", t("ctaEyebrow"))}
                        </p>
                        <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                          {sectionCopyString(content, "title", t("ctaTitle"))}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {sectionCopyString(content, "body", t("ctaBody"))}
                        </p>
                      </div>
                      <Link
                        href={href.startsWith("/") || href.startsWith("http") ? href : "/discover"}
                        className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
                      >
                        {sectionCopyString(content, "buttonLabel", t("ctaButton"))}
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            )
          }
          default:
            return null
        }
      })}
    </>
  )
}

function StorefrontHeroBlock({ store }: { store: ShopStoreSummary }) {
  if (store.theme.layout === "minimal") {
    if (!store.description?.trim()) return null
    return (
      <StorefrontTaglineBand
        description={store.description}
        accent={store.theme.accent}
        align={store.theme.headerBrandAlign}
      />
    )
  }

  return (
    <StorefrontDedicatedHero
      description={store.description}
      bannerUrl={store.bannerUrl}
      theme={store.theme}
      brandAlign={store.theme.headerBrandAlign}
    />
  )
}
