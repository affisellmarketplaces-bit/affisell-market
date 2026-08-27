import { NextResponse } from "next/server"

import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import { runProductImportAgent } from "@/lib/product-import-agent"
import type { SupplierImportUrlBody } from "@/lib/supplier-import-url-handler"

/**
 * Express / China import: AliExpress must go through the import agent (Open API +
 * controlled scrape fallback), never the hard-blocked generic scraper.
 * Returns the same `{ products: [...] }` shape as `handleSupplierImportUrl`.
 */
export async function tryImportChinaViaAgent(
  body: SupplierImportUrlBody
): Promise<NextResponse | null> {
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!url) return null

  const market = detectMarketplaceFromUrl(url)
  if (!market.preferAliExpressApi) return null

  const out = await runProductImportAgent({
    url,
    options: {
      markup: body.options?.markup,
      aiRewrite: body.options?.aiRewrite,
      // Express wants speed; still get title/price/images from AE API
      fast: true,
    },
  })

  if (!out.ok) {
    console.log("[import-china]", {
      result: "ae_agent_failed",
      marketplace: market.id,
      error: out.error.slice(0, 160),
      useBrowserCapture: out.useBrowserCapture ?? false,
    })
    return NextResponse.json(
      {
        error: out.error,
        useAliExpressApi: out.useAliExpressApi ?? true,
        useBrowserCapture: out.useBrowserCapture ?? false,
        marketplace: out.marketplace ?? market,
      },
      { status: out.status }
    )
  }

  const product = {
    ...out.product,
    ...(out.category?.leafId
      ? {
          categoryId: out.category.leafId,
          categoryBreadcrumb: out.category.breadcrumb,
        }
      : {}),
  }

  console.log("[import-china]", {
    result: "ae_agent_ok",
    marketplace: market.id,
    method: out.method,
    titleLen: product.title?.length ?? 0,
    price: product.price,
    imageCount: product.images?.length ?? 0,
    specCount: Object.keys(product.specs ?? {}).length,
    categoryLeaf: out.category?.leafId ?? null,
    hasSkuVariants: Boolean(out.skuVariants?.hasVariants),
  })

  return NextResponse.json({
    products: [product],
    platform: out.platform,
    method: out.method,
    warnings: out.warnings,
    marketplace: out.marketplace,
    category: out.category,
    skuVariants: out.skuVariants
      ? {
          hasVariants: out.skuVariants.hasVariants,
          variants: out.skuVariants.variantInputs,
          colors: out.skuVariants.colors,
          colorImages: out.skuVariants.colorImages,
          totalStock: out.skuVariants.totalStock,
        }
      : null,
  })
}
