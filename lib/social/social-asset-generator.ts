import type { BubbleProductView, SocialAssetKey, SocialAssetsBundle } from "@/lib/social/bubble-product-types"
import { SOCIAL_ASSET_DIMENSIONS } from "@/lib/social/bubble-product-types"
import { renderSocialAssetPng, socialAssetFileExists, socialAssetPublicPath } from "@/lib/social/render-social-asset.server"

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

/** Priority pack shown first in Viral Command Center (fast perceived success). */
export const SOCIAL_ASSET_PRIORITY_KEYS: SocialAssetKey[] = [
  "story_1080x1920",
  "feed_1080x1080",
  "tiktok_1080x1920",
  "pinterest_1000x1500",
]

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index]!, index)
    }
  })
  await Promise.all(runners)
  return results
}

type GeneratedRow = SocialAssetsBundle["assets"][number] & { ok: boolean; error?: string }

async function renderOne(
  product: BubbleProductView,
  key: SocialAssetKey,
  options: { persist: boolean; force?: boolean }
): Promise<GeneratedRow> {
  const spec = SOCIAL_ASSET_DIMENSIONS[key]
  const caption =
    key.includes("tiktok")
      ? buildViralCaptions(product).trendHook
      : key.includes("story") || key.includes("reel")
        ? `${product.title} — ${product.salePrice}€ · Link in bio`
        : `${product.title} — ${product.salePrice}€ · ${product.bubbleUrl}`

  const base = {
    key,
    template: spec.template,
    width: spec.width,
    height: spec.height,
    caption,
    relativePath: `generated/social/${product.id}/${key}.png`,
    publicUrl: socialAssetPublicPath(product.id, key),
  }

  try {
    if (!options.persist) {
      return { ...base, ok: true }
    }
    const exists = await socialAssetFileExists(product.id, key)
    if (!exists || options.force) {
      const rendered = await renderSocialAssetPng(product, key)
      return { ...base, publicUrl: rendered.publicUrl, ok: true }
    }
    return { ...base, ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "render_failed"
    console.error("[social-asset-generator]", { productId: product.id, key, error: message })
    return { ...base, ok: false, error: message }
  }
}

/** Factory: bubble social asset specs (+ PNG on disk when `persist` true). Partial success OK. */
export async function generateSocialAssets(
  product: BubbleProductView,
  options?: { keys?: SocialAssetKey[]; persist?: boolean; force?: boolean; concurrency?: number }
): Promise<SocialAssetsBundle & { failedKeys: SocialAssetKey[]; okCount: number }> {
  const keys = options?.keys?.length ? options.keys : ALL_KEYS
  const persist = options?.persist !== false
  const captions = buildViralCaptions(product)
  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 3, 6))

  const rows = await mapPool(keys, concurrency, (key) =>
    renderOne(product, key, { persist, force: options?.force })
  )

  const assets = rows.map(({ ok: _ok, error: _error, ...asset }) => asset)
  const failedKeys = rows.filter((r) => !r.ok).map((r) => r.key)
  const okCount = rows.length - failedKeys.length

  console.log("[social-asset-generator]", {
    productId: product.id,
    count: assets.length,
    okCount,
    failedKeys,
  })

  if (okCount === 0) {
    const err = new Error(failedKeys[0] ? `all_assets_failed:${failedKeys[0]}` : "all_assets_failed")
    throw err
  }

  return {
    productId: product.id,
    generatedAt: new Date().toISOString(),
    assets,
    captions,
    failedKeys,
    okCount,
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
