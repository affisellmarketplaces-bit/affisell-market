import { auth } from "@/auth"
import { AffisellPulseExperience } from "@/components/pulse/affisell-pulse-experience"
import { BuyerSwipeCommerce } from "@/components/pulse/buyer-swipe-commerce"
import { loadBuyerSwipeFeedItems } from "@/lib/buyer-swipe-feed.server"
import { loadPulseFeedItems } from "@/lib/pulse-feed-data"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Affisell Pulse",
  description: "Immersive shoppable swipe feed — discover and buy in one gesture.",
}

type PageProps = {
  searchParams: Promise<{
    category?: string
    subcategory?: string
    layout?: string
  }>
}

export default async function DiscoverPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const session = await auth()
  const layout = sp.layout === "scroll" ? "scroll" : "swipe"

  const categoryId = sp.category?.trim() || null
  const subcategoryId = sp.subcategory?.trim() || null
  const feedParams = new URLSearchParams()
  if (categoryId) feedParams.set("category", categoryId)
  if (subcategoryId) feedParams.set("subcategory", subcategoryId)

  let categoryLabel: string | null = null
  const scopeId = subcategoryId ?? categoryId
  if (scopeId) {
    const cat = await prisma.category.findUnique({
      where: { id: scopeId },
      select: { name: true },
    })
    categoryLabel = cat?.name ?? null
  }

  if (layout === "scroll") {
    const items = await loadPulseFeedItems({
      userId: session?.user?.id ?? null,
      limit: 40,
    })
    return (
      <AffisellPulseExperience
        items={items}
        viewerLoggedIn={Boolean(session?.user?.id)}
      />
    )
  }

  const items = await loadBuyerSwipeFeedItems(feedParams, { limit: 24 })

  return (
    <BuyerSwipeCommerce
      initialItems={items}
      categoryId={categoryId}
      subcategoryId={subcategoryId}
      categoryLabel={categoryLabel}
    />
  )
}
