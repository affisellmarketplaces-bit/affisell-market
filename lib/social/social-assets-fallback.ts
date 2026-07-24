import {
  SOCIAL_ASSET_DIMENSIONS,
  type BubbleProductView,
  type SocialAssetKey,
  type SocialAssetsBundle,
} from "@/lib/social/bubble-product-types"
import { buildViralCaptions } from "@/lib/social/viral-captions"

/** 3 static templates always shown when PNG/Satori generation is down. */
export const SOCIAL_ASSET_FALLBACK_KEYS: SocialAssetKey[] = [
  "story_1080x1920",
  "feed_1080x1080",
  "tiktok_1080x1920",
]

const PLACEHOLDER = "/placeholder.png"

/**
 * Client + server safe fallback pack — product image + captions + profit hooks.
 * Never blocks reseller revenue when ImageResponse / disk write fails.
 */
export function getFallbackSocialAssetsBundle(
  product: Pick<
    BubbleProductView,
    "id" | "title" | "imageUrl" | "salePrice" | "costPrice" | "marginEuro" | "bubbleUrl"
  >
): SocialAssetsBundle & { failedKeys: SocialAssetKey[]; okCount: number; fallback: true } {
  const captions = buildViralCaptions(product)
  const image = (product.imageUrl?.trim() || PLACEHOLDER) as string

  const assets = SOCIAL_ASSET_FALLBACK_KEYS.map((key) => {
    const spec = SOCIAL_ASSET_DIMENSIONS[key]
    const caption =
      key.includes("tiktok")
        ? captions.trendHook
        : key.includes("story")
          ? `${product.title} — ${product.salePrice}€ · Link in bio`
          : `${product.title} — ${product.salePrice}€ · +${product.marginEuro.toFixed(0)}€`

    return {
      key,
      template: spec.template,
      width: spec.width,
      height: spec.height,
      caption,
      relativePath: `fallback/${product.id}/${key}`,
      publicUrl: image,
    }
  })

  return {
    productId: product.id,
    generatedAt: new Date().toISOString(),
    assets,
    captions,
    failedKeys: [...SOCIAL_ASSET_FALLBACK_KEYS],
    okCount: 0,
    fallback: true,
  }
}
