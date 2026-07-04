import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { StorefrontStaticPageView } from "@/components/storefront/storefront-static-page-view"
import { resolveStoreStaticPage } from "@/lib/storefront-static-page-route"

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { store, page } = await resolveStoreStaticPage(slug, "faq")
  const t = await getTranslations("storefront.staticPages")
  const title = page.title?.trim() || t("defaults.faq.title", { name: store.name })
  return {
    title: `${title} · ${store.name}`,
    description: t("defaults.faq.metaDescription", { name: store.name }),
    robots: { index: true, follow: true },
  }
}

export default async function ShopFaqPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await resolveStoreStaticPage(slug, "faq")

  return (
    <StorefrontStaticPageView
      storeName={ctx.store.name}
      kind="faq"
      page={ctx.page}
      shopHomePath={ctx.shopHomePath}
      enabledKinds={ctx.enabledKinds}
    />
  )
}
