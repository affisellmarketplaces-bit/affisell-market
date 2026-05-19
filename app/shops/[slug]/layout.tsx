import { AffiliateStorePreviewBanner } from "@/components/shop/AffiliateStorePreviewBanner"
import { ShopStoreHeader } from "@/components/shop/ShopStoreHeader"
import { auth } from "@/auth"
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
  const [store, session] = await Promise.all([loadAffiliateShopStore(slug), auth()])
  const isOwner =
    Boolean(session?.user?.id && store?.userId) &&
    session?.user?.role === "AFFILIATE" &&
    store?.userId === session.user.id

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AffiliateStorePreviewBanner storeSlug={slug} isOwner={isOwner} />
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
