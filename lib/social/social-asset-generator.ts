import type { BubbleProductView, SocialAssetKey, SocialAssetsBundle } from "@/lib/social/bubble-product-types"
import { SOCIAL_ASSET_DIMENSIONS } from "@/lib/social/bubble-product-types"
import { renderSocialAssetPng, socialAssetFileExists } from "@/lib/social/render-social-asset.server"

export function buildViralCaptions(product: BubbleProductView) {
  const cost = product.costPrice?.toFixed(0) ?? "?"
  const sale = product.salePrice.toFixed(0)
  const title = product.title.slice(0, 60)
  return {
    moneyHook: `J'ai trouvé ce ${title} à ${cost}€ et je le revends ${sale}€ sans stock… Voilà comment 👇 ${product.bubbleUrl}`,
    problemHook: `Marre de chercher des produits rentables? Ce ${title} fait +${product.marginEuro.toFixed(0)}€ sans stock. ${product.bubbleUrl}`,
    trendHook: `POV: Tu découvres le produit que tout le monde va acheter en 2026 — ${title} · ${sale}€ ${product.bubbleUrl}`,
  }
}

const ALL_KEYS = Object.keys(SOCIAL_ASSET_DIMENSIONS) as SocialAssetKey[]

/** Factory: 12 bubble social asset specs (+ PNG on disk when `persist` true). */
export async function generateSocialAssets(
  product: BubbleProductView,
  options?: { keys?: SocialAssetKey[]; persist?: boolean; force?: boolean }
): Promise<SocialAssetsBundle> {
  const keys = options?.keys?.length ? options.keys : ALL_KEYS
  const persist = options?.persist !== false
  const captions = buildViralCaptions(product)
  const assets: SocialAssetsBundle["assets"] = []

  for (const key of keys) {
    const spec = SOCIAL_ASSET_DIMENSIONS[key]
    let publicUrl = `/generated/social/${product.id}/${key}.png`
    const exists = persist ? await socialAssetFileExists(product.id, key) : false
    if (persist && (!exists || options?.force)) {
      const rendered = await renderSocialAssetPng(product, key)
      publicUrl = rendered.publicUrl
    }

    const caption =
      key.includes("tiktok")
        ? captions.trendHook
        : key.includes("story") || key.includes("reel")
          ? `${product.title} — ${product.salePrice}€ · Link in bio`
          : `${product.title} — ${product.salePrice}€ · ${product.bubbleUrl}`

    assets.push({
      key,
      template: spec.template,
      width: spec.width,
      height: spec.height,
      caption,
      relativePath: `generated/social/${product.id}/${key}.png`,
      publicUrl,
    })
  }

  console.log("[social-asset-generator]", { productId: product.id, count: assets.length })

  return {
    productId: product.id,
    generatedAt: new Date().toISOString(),
    assets,
    captions,
  }
}

export type GeneratedSocialAssetMap = Record<
  string,
  { template: string; width: number; height: number; caption: string; publicUrl: string }
>

/** Shape aligned with product spec (12 templates). */
export function bundleToLegacyMap(bundle: SocialAssetsBundle): GeneratedSocialAssetMap {
  const out: GeneratedSocialAssetMap = {}
  for (const a of bundle.assets) {
    out[a.key] = {
      template: a.template,
      width: a.width,
      height: a.height,
      caption: a.caption,
      publicUrl: a.publicUrl,
    }
  }
  return out
}
