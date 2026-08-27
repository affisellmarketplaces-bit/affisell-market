import { runProductImportAgent } from "@/lib/product-import-agent"
import type { SupplierImportUrlBody } from "@/lib/supplier-import-url-handler"

export type WizardV2AeImportPayload = {
  products: Record<string, unknown>[]
  platform: string
  method: string
  warnings: string[]
  category: {
    leafId: string | null
    breadcrumb: string
    confidence: number
    reason: string
  } | null
  skuVariants: {
    hasVariants: boolean
    variants: unknown[]
    colors: unknown[]
    colorImages: unknown[]
    totalStock: number
  } | null
}

/** Run import agent on browser-captured AE JSON → wizard Express payload. */
export async function buildWizardV2ImportFromAerCapture(
  aeUrl: string,
  aerData: unknown,
  options?: SupplierImportUrlBody["options"]
): Promise<{ ok: true; payload: WizardV2AeImportPayload } | { ok: false; error: string; status: number }> {
  const out = await runProductImportAgent({
    url: aeUrl,
    aerData,
    options: {
      markup: options?.markup ?? 2.5,
      aiRewrite: options?.aiRewrite,
      fast: true,
    },
  })

  if (!out.ok) {
    return { ok: false, error: out.error, status: out.status }
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

  return {
    ok: true,
    payload: {
      products: [product as Record<string, unknown>],
      platform: out.platform,
      method: out.method,
      warnings: out.warnings,
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
    },
  }
}
