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
  const { store, page } = await resolveStoreStaticPage(slug, "about")
  const t = await getTranslations("storefront.staticPages")
  const title = page.title?.trim() || t("defaults.about.title", { name: store.name })
  const description =
    page.body?.trim().slice(0, 160) ||
    t("defaults.about.body", { name: store.name }).slice(0, 160)
  return {
    title: `${title} · ${store.name}`,
    description,
    robots: { index: true, follow: true },
  }
}

export default async function ShopAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await resolveStoreStaticPage(slug, "about")

  return (
    <StorefrontStaticPageView
      storeName={ctx.store.name}
      kind="about"
      page={ctx.page}
      shopHomePath={ctx.shopHomePath}
      enabledKinds={ctx.enabledKinds}
    />
  )
}
