/** Shared bubble / viral product DTO — safe for client. */
export type BubbleProductVariant =
  | "bubble-mini"
  | "bubble-card"
  | "bubble-story"
  | "bubble-feed"
  | "bubble-tiktok"

export type BubbleProductView = {
  id: string
  title: string
  imageUrl: string | null
  salePrice: number
  compareAtPrice: number | null
  costPrice: number | null
  marginEuro: number
  deliveryDays: number
  deliveryCountry: string
  supplierTrustScore: number
  supplierName: string | null
  listingId: string | null
  bubbleUrl: string
}

export type SocialAssetKey =
  | "story_1080x1920"
  | "feed_1080x1080"
  | "tiktok_1080x1920"
  | "pinterest_1000x1500"
  | "reel_cover_1080x1920"
  | "twitter_1200x675"
  | "linkedin_1200x627"
  | "facebook_1200x630"
  | "telegram_1280x720"
  | "whatsapp_800x800"
  | "youtube_1280x720"
  | "threads_1080x1080"

export type SocialAssetSpec = {
  key: SocialAssetKey
  template: string
  width: number
  height: number
  caption: string
  relativePath: string
  publicUrl: string
}

export type SocialAssetsBundle = {
  productId: string
  generatedAt: string
  assets: SocialAssetSpec[]
  captions: {
    moneyHook: string
    problemHook: string
    trendHook: string
  }
}

export const SOCIAL_ASSET_DIMENSIONS: Record<
  SocialAssetKey,
  { width: number; height: number; template: string }
> = {
  story_1080x1920: { width: 1080, height: 1920, template: "bubble-story" },
  feed_1080x1080: { width: 1080, height: 1080, template: "bubble-feed" },
  tiktok_1080x1920: { width: 1080, height: 1920, template: "bubble-tiktok" },
  pinterest_1000x1500: { width: 1000, height: 1500, template: "bubble-pinterest" },
  reel_cover_1080x1920: { width: 1080, height: 1920, template: "bubble-reel" },
  twitter_1200x675: { width: 1200, height: 675, template: "bubble-twitter" },
  linkedin_1200x627: { width: 1200, height: 627, template: "bubble-linkedin" },
  facebook_1200x630: { width: 1200, height: 630, template: "bubble-facebook" },
  telegram_1280x720: { width: 1280, height: 720, template: "bubble-telegram" },
  whatsapp_800x800: { width: 800, height: 800, template: "bubble-whatsapp" },
  youtube_1280x720: { width: 1280, height: 720, template: "bubble-youtube" },
  threads_1080x1080: { width: 1080, height: 1080, template: "bubble-threads" },
}
