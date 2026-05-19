import { Suspense } from "react"

import { ShopBuyerAuthForm } from "@/components/auth/shop-buyer-auth-form"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"

export default async function ShopBuyerSignupPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const store = await loadAffiliateShopStore(slug).catch(() => null)
  const storeName = store?.name ?? slug

  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center">Chargement…</div>}>
      <ShopBuyerAuthForm storeName={storeName} shopSlug={slug} mode="signup" />
    </Suspense>
  )
}
