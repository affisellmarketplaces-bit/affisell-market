import type { SocialAssetKey } from "@/lib/social/bubble-product-types"
import { SOCIAL_ASSET_DIMENSIONS } from "@/lib/social/bubble-product-types"

const PLATFORM_KEYS: Record<string, SocialAssetKey[]> = {
  instagram: ["story_1080x1920", "feed_1080x1080", "reel_cover_1080x1920"],
  tiktok: ["tiktok_1080x1920"],
  pinterest: ["pinterest_1000x1500"],
  facebook: ["facebook_1200x630"],
  twitter: ["twitter_1200x675"],
  linkedin: ["linkedin_1200x627"],
  telegram: ["telegram_1280x720"],
  whatsapp: ["whatsapp_800x800"],
  youtube: ["youtube_1280x720"],
  threads: ["threads_1080x1080"],
}

export function socialKeysForPlatforms(platforms: string[]): SocialAssetKey[] {
  const set = new Set<SocialAssetKey>()
  for (const p of platforms) {
    const keys = PLATFORM_KEYS[p.toLowerCase()]
    if (keys) keys.forEach((k) => set.add(k))
  }
  return [...set]
}

export function parseSocialAssetKey(format: string): SocialAssetKey | null {
  if (format in SOCIAL_ASSET_DIMENSIONS) return format as SocialAssetKey
  const alias: Record<string, SocialAssetKey> = {
    story: "story_1080x1920",
    feed: "feed_1080x1080",
    tiktok: "tiktok_1080x1920",
    pinterest: "pinterest_1000x1500",
  }
  return alias[format] ?? null
}
