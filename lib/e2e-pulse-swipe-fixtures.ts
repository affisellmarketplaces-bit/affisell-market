import type { PulseFeedItem } from "@/lib/pulse-feed-types"

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
