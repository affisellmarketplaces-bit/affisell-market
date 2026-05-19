import { ShopStoreHeader } from "@/components/shop/ShopStoreHeader"
import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"

export const dynamic = "force-dynamic"

export default async function ShopPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const store = await loadAffiliateShopStore(slug)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {store ? (
        <ShopStoreHeader
          storeName={store.name}
          logoUrl={store.logoUrl ?? store.aiAvatarUrl}
          description={store.description}
        />
      ) : null}
      <main>{children}</main>
    </div>
  )
}
