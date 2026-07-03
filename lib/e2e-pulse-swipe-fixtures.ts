import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"

/** Playwright-only — injects a stable swipe deck when `E2E_PULSE_FIXTURES=1`. */
export function isE2ePulseFixturesEnabled(): boolean {
  return process.env.E2E_PULSE_FIXTURES === "1"
}

/** Non-prod: env flag or `?e2eFixtures=1` (Playwright with reused dev server). */
export function shouldUseE2ePulseFixtures(query: {
  e2eFixtures?: string | null
}): boolean {
  if (process.env.NODE_ENV === "production") return false
  return isE2ePulseFixturesEnabled() || query.e2eFixtures === "1"
}

const FIXTURE_MEDIA =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=640&q=80"

export function e2ePulseSwipeFixtureItems(): PulseFeedItem[] {
  return [
    {
      id: "e2e-pulse-alpha",
      source: "product",
      productId: "e2e-product-alpha",
      listingId: "e2e-listing-alpha",
      storeSlug: "e2e-store",
      storeName: "E2E Store",
      storeAvatarUrl: null,
      title: "E2E Pulse Alpha",
      caption: null,
      priceCents: 4_900,
      compareAtCents: null,
      soldCount: 12,
      mediaUrl: FIXTURE_MEDIA,
      isVideo: false,
      mediaGallery: [{ url: FIXTURE_MEDIA, isVideo: false }],
      likes: 0,
      views: 0,
      boosted: false,
      href: "/marketplace/e2e-listing-alpha",
    },
    {
      id: "e2e-pulse-beta",
      source: "product",
      productId: "e2e-product-beta",
      listingId: "e2e-listing-beta",
      storeSlug: "e2e-store",
      storeName: "E2E Store",
      storeAvatarUrl: null,
      title: "E2E Pulse Beta",
      caption: null,
      priceCents: 7_500,
      compareAtCents: 9_900,
      soldCount: 3,
      mediaUrl: FIXTURE_MEDIA,
      isVideo: false,
      mediaGallery: [{ url: FIXTURE_MEDIA, isVideo: false }],
      likes: 0,
      views: 0,
      boosted: true,
      href: "/marketplace/e2e-listing-beta",
    },
  ]
}

export function e2ePulsePersonalizedPicksFixture(): BuyerPersonalizedPicksPayload {
  const base = {
    imageUrl: FIXTURE_MEDIA,
    compareAtCents: null as number | null,
    soldCount: 8,
    marginCents: 0,
    deliveryMin: 2,
    deliveryMax: 5,
    stock: 12,
    freeShipping: true,
    commissionPct: 0,
    averageRating: 4.7,
    reviewCount: 9,
    storeName: "E2E Store",
    storeSlug: "e2e-store",
    nicheLabel: "lifestyle" as const,
    categories: ["Fashion"],
    isBestSeller: false,
  }

  return {
    personalized: true,
    items: [1, 2, 3, 4].map((n) => ({
      ...base,
      listingId: `e2e-listing-pick-${n}`,
      productId: `e2e-product-pick-${n}`,
      name: `E2E Recommended Pick ${n}`,
      priceCents: 3_900 + n * 100,
    })),
  }
}
