import { auth } from "@/auth"
import type { Session } from "next-auth"
import { AffisellPulseExperience } from "@/components/pulse/affisell-pulse-experience"
import { BuyerSwipeCommerce } from "@/components/pulse/buyer-swipe-commerce"
import { loadBuyerPersonalizedPicksSafe } from "@/lib/buyer-personalized-picks"
import { loadBuyerSwipeFeedItems } from "@/lib/buyer-swipe-feed.server"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"
import { e2ePulseSwipeFixtureItems, shouldUseE2ePulseFixtures } from "@/lib/e2e-pulse-swipe-fixtures"
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
    e2eFixtures?: string
  }>
}

export default async function DiscoverPage({ searchParams }: PageProps) {
  const sp = await searchParams
  let session: Session | null = null
  try {
    session = await auth()
  } catch (e) {
    console.error("[discover]", {
      stage: "auth",
      error: e instanceof Error ? e.message : String(e),
    })
  }
  const layout = sp.layout === "scroll" ? "scroll" : "swipe"

  const categoryId = sp.category?.trim() || null
  const subcategoryId = sp.subcategory?.trim() || null
  const feedParams = new URLSearchParams()
  if (categoryId) feedParams.set("category", categoryId)
  if (subcategoryId) feedParams.set("subcategory", subcategoryId)

  const useE2eFixtures = shouldUseE2ePulseFixtures({ e2eFixtures: sp.e2eFixtures })

  let categoryLabel: string | null = null
  const scopeId = subcategoryId ?? categoryId
  if (scopeId) {
    try {
      const cat = await prisma.category.findUnique({
        where: { id: scopeId },
        select: { name: true },
      })
      categoryLabel = cat?.name ?? null
    } catch (e) {
      console.error("[discover]", {
        scopeId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  if (layout === "scroll") {
    let items: Awaited<ReturnType<typeof loadPulseFeedItems>> = []
    try {
      items = await loadPulseFeedItems({
        userId: session?.user?.id ?? null,
        limit: 40,
      })
    } catch (e) {
      console.error("[discover]", {
        layout: "scroll",
        error: e instanceof Error ? e.message : String(e),
      })
    }
    return (
      <AffisellPulseExperience
        items={items}
        viewerLoggedIn={Boolean(session?.user?.id)}
      />
    )
  }

  let items: Awaited<ReturnType<typeof loadBuyerSwipeFeedItems>> = []
  let personalizedPicks: Awaited<ReturnType<typeof loadBuyerPersonalizedPicksSafe>> = {
    items: [],
    personalized: false,
  }
  if (useE2eFixtures) {
    items = e2ePulseSwipeFixtureItems()
  } else {
    try {
      const guestId = await readGuestWishlistId()
      const [feedItems, picks] = await Promise.all([
        loadBuyerSwipeFeedItems(feedParams, { limit: 24 }),
        loadBuyerPersonalizedPicksSafe({
          userId: session?.user?.id ?? null,
          guestId,
        }),
      ])
      items = feedItems
      personalizedPicks = picks
    } catch (e) {
      console.error("[discover]", {
        layout: "swipe",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <BuyerSwipeCommerce
      initialItems={items}
      categoryId={categoryId}
      subcategoryId={subcategoryId}
      categoryLabel={categoryLabel}
      initialPersonalizedPicks={personalizedPicks}
    />
  )
}
