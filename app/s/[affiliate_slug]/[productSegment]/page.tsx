import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"

import { SeoParasiteProductPage } from "@/components/seo/seo-parasite-product-page"
import { appendCrossSocialProofJsonLd } from "@/lib/product-social-proof-seo"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"
import { buildParasiteProductJsonLd } from "@/lib/seo-parasite-jsonld"
import { loadSeoParasitePageData } from "@/lib/seo-parasite.server"

export const revalidate = 60

type PageProps = {
  params: Promise<{ affiliate_slug: string; productSegment: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { affiliate_slug, productSegment } = await params
  const data = await loadSeoParasitePageData(affiliate_slug, productSegment)
  if (!data) {
    return { title: "Produit introuvable | Affisell", robots: { index: false, follow: false } }
  }

  const title = `${data.productName} par ${data.shopName} | Affisell`
  const description =
    data.productDescription?.trim().slice(0, 160) ||
    `${data.productName} — disponible chez ${data.shopName} sur Affisell.`

  return {
    title,
    description,
    alternates: {
      canonical: data.canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: data.canonicalUrl,
      ...(data.imageUrl ? { images: [{ url: data.imageUrl, alt: data.productName }] } : {}),
    },
  }
}

export default async function SeoParasiteAffiliateProductPage({ params }: PageProps) {
  const { affiliate_slug, productSegment } = await params
  const data = await loadSeoParasitePageData(affiliate_slug, productSegment)
  if (!data) notFound()

  const localeFromContext = await getLocale()
  const locale = resolveBinaryCopyLocale(localeFromContext)

  const productJsonLd = appendCrossSocialProofJsonLd(
    buildParasiteProductJsonLd({
      name: data.productName,
      description: data.productDescription,
      imageUrl: data.imageUrl,
      priceCents: data.sellingPriceCents,
      sellerName: data.shopName,
      pageUrl: data.canonicalUrl,
      customerFacing: true,
    }),
    data.socialProof
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <SeoParasiteProductPage data={data} locale={locale} />
    </>
  )
}
