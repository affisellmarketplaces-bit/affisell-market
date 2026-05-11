import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import type { StoreFeedPost } from "@/components/community/StoreFeed"
import { StoreFeed } from "@/components/community/StoreFeed"
import { StoreSocialBar } from "@/components/store-social-bar"
import { auth } from "@/auth"
import { buyerRewardBadgeText, normalizeBuyerRewardKind } from "@/lib/affiliate-buyer-reward"
import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import { parseFollowersJson } from "@/lib/format-followers"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

import { MarketplaceListingCard } from "../../marketplace/marketplace-listing-card"

export const dynamic = "force-dynamic"

export default async function PublicStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, role: true } },
    },
  })

  if (!store) notFound()

  const role = store.user.role

  const [followCount, communityPosts] = await Promise.all([
    prisma.follow.count({ where: { storeId: store.id } }),
    prisma.communityPost.findMany({
      where: { storeId: store.id },
      include: { product: { select: { id: true, name: true, images: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ])

  let initialFollowing = false
  if (session?.user?.id) {
    const f = await prisma.follow.findUnique({
      where: {
        userId_storeId: { userId: session.user.id, storeId: store.id },
      },
    })
    initialFollowing = Boolean(f)
  }

  const followers = parseFollowersJson(store.followers)
  const feedPosts: StoreFeedPost[] = communityPosts.map((p) => ({
    id: p.id,
    content: p.content,
    images: p.images ?? [],
    likes: p.likes,
    createdAt: p.createdAt.toISOString(),
    productId: p.productId,
    product: p.product
      ? { id: p.product.id, name: p.product.name, images: p.product.images ?? [] }
      : null,
  }))

  const socialBar =
    store.showSocialsOnStore ? (
      <StoreSocialBar
        storeSlug={store.slug}
        instagram={store.instagram}
        tiktok={store.tiktok}
        youtube={store.youtube}
        twitch={store.twitch}
        followers={followers}
        isLive={store.isLive}
        liveUrl={store.liveUrl}
        followCount={followCount}
        initialFollowing={initialFollowing}
        viewerLoggedIn={Boolean(session?.user?.id)}
      />
    ) : null

  const communitySection = (
    <section id="community" className="mt-14">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Community</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Updates, drops, and reactions from this store.</p>
      <div className="mt-6">
        <StoreFeed storeSlug={slug} posts={feedPosts} />
      </div>
    </section>
  )

  if (role === "AFFILIATE") {
    const listings = await prisma.affiliateProduct.findMany({
      where: { affiliateId: store.user.id, isListed: true, product: { active: true } },
      include: { product: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    })

    return (
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <nav className="text-sm">
          <Link href="/marketplace" className="text-zinc-500 underline hover:text-zinc-700">
            ← Marketplace
          </Link>
        </nav>

        <header className="mt-8 flex flex-wrap items-center gap-4">
          {store.logoUrl ? (
            <Image
              src={store.logoUrl}
              alt=""
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-xl border border-zinc-200 object-contain"
              unoptimized={store.logoUrl.startsWith("http") || store.logoUrl.startsWith("/uploads")}
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{store.name}</h1>
            {store.customDomain ? (
              <p className="text-sm text-zinc-500">{store.customDomain}</p>
            ) : (
              <p className="text-sm text-zinc-500">{slug}</p>
            )}
          </div>
        </header>

        {socialBar}

        {store.description ? (
          <p className="mt-4 max-w-2xl text-sm text-zinc-600">{store.description}</p>
        ) : null}

        {store.bannerUrl ? (
          <div className="relative mt-6 aspect-[5/1] w-full overflow-hidden rounded-xl bg-zinc-100">
            <Image
              src={store.bannerUrl}
              alt=""
              fill
              className="object-cover"
              sizes="1200px"
              unoptimized={store.bannerUrl.startsWith("http") || store.bannerUrl.startsWith("/uploads")}
            />
          </div>
        ) : null}

        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {listings.filter((x) => x.product).length === 0 ? (
            <li className="col-span-full text-center text-zinc-500">No active listings.</li>
          ) : (
            listings
              .filter((item) => item.product)
              .map((item) => (
                <li key={item.id} className="flex h-full">
                  <MarketplaceListingCard
                    detailHref={`/marketplace/${item.id}`}
                    imageUrl={
                      listingPrimaryImageUrl(item.customImages, item.product!.images) ||
                      primaryProductImage(item.product!.images) ||
                      null
                    }
                    name={listingDisplayTitle(item.customTitle, item.product!.name)}
                    priceDisplay={(item.sellingPriceCents / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: "EUR",
                    })}
                    sellerDisplay={store.name}
                    soldByAffiliate={store.name}
                    trackClicks
                    fastShipping={(item.product!.deliveryMax ?? 99) <= 3}
                    buyerRewardBadge={buyerRewardBadgeText(
                      normalizeBuyerRewardKind(item.buyerRewardKind),
                      item.buyerRewardPercent ?? 0
                    )}
                    product={{ id: item.id }}
                  />
                </li>
              ))
          )}
        </ul>

        {communitySection}
      </main>
    )
  }

  const supplierProducts =
    role === "SUPPLIER"
      ? await prisma.product.findMany({
          where: { supplierId: store.user.id, active: true },
          orderBy: { name: "asc" },
        })
      : []

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <nav className="text-sm">
        <Link href="/marketplace" className="text-zinc-500 underline hover:text-zinc-700">
          ← Marketplace
        </Link>
      </nav>

      <header className="mt-8 flex flex-wrap items-center gap-4">
        {store.logoUrl ? (
          <Image
            src={store.logoUrl}
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-xl border border-zinc-200 object-contain"
            unoptimized={store.logoUrl.startsWith("http") || store.logoUrl.startsWith("/uploads")}
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{store.name}</h1>
          <p className="text-sm text-zinc-500">Supplier catalog</p>
        </div>
      </header>

      {socialBar}

      {store.description ? (
        <p className="mt-4 max-w-2xl text-sm text-zinc-600">{store.description}</p>
      ) : null}

      <section className="mt-12">
        <h2 className="text-lg font-medium text-zinc-900">Products</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {supplierProducts.length === 0 ? (
            <li className="col-span-full text-zinc-500">No active products listed.</li>
          ) : (
            supplierProducts.map((p) => {
              const mainImg = primaryProductImage(p.images) || "/placeholder.png"
              return (
                <li
                  key={p.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <Link href={`/marketplace`} className="block">
                    <div className="relative mx-auto mb-3 aspect-square w-full max-h-40 bg-zinc-50 dark:bg-zinc-800">
                      <Image
                        src={mainImg}
                        alt={p.name}
                        fill
                        className="object-contain p-2"
                        sizes="240px"
                        unoptimized={mainImg.startsWith("http")}
                      />
                    </div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Available through affiliate listings on the marketplace
                    </p>
                  </Link>
                </li>
              )
            })
          )}
        </ul>
      </section>

      {communitySection}
    </main>
  )
}
