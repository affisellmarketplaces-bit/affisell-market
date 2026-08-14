import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { StorefrontFormatsLab } from "@/components/demo/storefront-formats-lab"
import { loadStorefrontFormatsLabSlugs } from "@/lib/storefront/storefront-formats-lab.server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("demoLab.storefrontFormats")
  return {
    title: `${t("title")} | Affisell Demo Lab`,
    description: t("subtitle"),
    robots: { index: true, follow: true },
  }
}

export default async function StorefrontFormatsLabPage() {
  const slugs = await loadStorefrontFormatsLabSlugs()
  return <StorefrontFormatsLab slugs={slugs} />
}
