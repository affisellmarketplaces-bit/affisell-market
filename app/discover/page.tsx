import { auth } from "@/auth"
import { DiscoverFeed, type DiscoverItem } from "@/components/discover-feed"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const VIDEO_RE = /\.(mp4|webm|mov)(\?.*)?$/i

function pickMedia(images: string[]): { mediaUrl: string | null; isVideo: boolean } {
  const cleaned = images.filter((u) => typeof u === "string" && u.trim())
  const first = cleaned[0]?.trim() || null
  if (!first) return { mediaUrl: null, isVideo: false }
  return { mediaUrl: first, isVideo: VIDEO_RE.test(first) }
}

export default async function DiscoverPage() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const [history, products] = await Promise.all([
    userId
      ? prisma.searchHistory.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: { productId: true, query: true },
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      take: 20,
      where: {
        active: true,
        isDraft: false,
        affiliateProducts: {
          some: { isListed: true, affiliate: { role: "AFFILIATE" } },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        basePriceCents: true,
        images: true,
        affiliateProducts: {
          where: { isListed: true, affiliate: { role: "AFFILIATE" } },
          take: 1,
          orderBy: { id: "asc" },
          select: { id: true, sellingPriceCents: true },
        },
      },
    }),
  ])

  const touchedProductIds = new Set(history.map((h) => h.productId).filter(Boolean) as string[])
  const queryWords = new Set(
    history
      .flatMap((h) => (h.query || "").toLowerCase().split(/\s+/))
      .map((w) => w.trim())
      .filter((w) => w.length >= 3)
  )

  const scored = products.map((p) => {
    const touched = touchedProductIds.has(p.id) ? 2 : 0
    const word = [...queryWords].some((w) => p.name.toLowerCase().includes(w)) ? 1 : 0
    const score = touched + word
    return { product: p, score }
  })

  const ranked = [...scored].sort((a, b) => b.score - a.score)

  const items: DiscoverItem[] = ranked.map(({ product: p, score }) => {
    const listing = p.affiliateProducts[0]!
    const { mediaUrl, isVideo } = pickMedia(p.images ?? [])
    return {
      productId: p.id,
      listingId: listing.id,
      name: p.name,
      priceCents: listing.sellingPriceCents,
      mediaUrl,
      isVideo,
      boosted: score > 0,
    }
  })

  return <DiscoverFeed items={items} />
}
