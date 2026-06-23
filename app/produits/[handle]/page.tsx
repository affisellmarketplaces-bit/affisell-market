import { notFound } from "next/navigation"

import { MedusaProductTryOnSection } from "@/components/produits/medusa-product-try-on-section"
import { resolveTryOnFeatureEnabled } from "@/lib/flags/try-on"
import { resolveProductForTryOnPage } from "@/lib/medusa/fetch-product"

export const revalidate = 60

type PageProps = {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ tryon?: string }>
}

/** Medusa storefront PDP — Virtual Try-On when `try_on_enabled` + garment URL. */
export default async function MedusaProductPage({ params, searchParams }: PageProps) {
  const { handle } = await params
  const sp = await searchParams
  const product = await resolveProductForTryOnPage(handle)

  if (!product) {
    notFound()
  }

  const tryOnFeatureEnabled = resolveTryOnFeatureEnabled(
    sp.tryon ? new URLSearchParams({ tryon: sp.tryon }) : null
  )

  return (
    <main className="min-h-[60dvh]">
      <MedusaProductTryOnSection product={product} tryOnFeatureEnabled={tryOnFeatureEnabled} />
    </main>
  )
}
