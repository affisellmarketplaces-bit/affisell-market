import { Suspense } from "react"

import { ShopBuyerAuthForm } from "@/components/auth/shop-buyer-auth-form"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"
import { getAffiliateStoreHostSlug } from "@/lib/storefront-buyer-host.server"

export default async function ShopBuyerLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const store = await loadAffiliateShopStore(slug).catch(() => null)
  const storeName = store?.name ?? slug
  const isStoreHost = (await getAffiliateStoreHostSlug()) === slug

  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center">Chargement…</div>}>
      <ShopBuyerAuthForm storeName={storeName} shopSlug={slug} mode="login" isStoreHost={isStoreHost} />
    </Suspense>
  )
}
