import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { AdminPostProductsProductTryOnSchema } from "../../validators"
import { checkAdminTryOnRateLimit } from "../../../../../lib/rate-limit"
import { validateTryOnGarmentUrl } from "../../../../../lib/try-on-url-validator"
import { PRODUCT_TRY_ON_MODULE } from "../../../../../modules/product-try-on"
import type ProductTryOnModuleService from "../../../../../modules/product-try-on/service"

const patchBodySchema = z.object({
  try_on_enabled: z.boolean(),
  tryon_garment_url: z.string().nullable().optional(),
})

type TryOnRecord = {
  id: string
  try_on_enabled: boolean
  tryon_garment_url: string | null
}

type AuthedMedusaRequest = MedusaRequest & {
  auth_context?: { actor_id?: string }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ message: "product id required" })
    return
  }

  const authed = req as AuthedMedusaRequest
  const actor = authed.auth_context?.actor_id ?? req.ip ?? "anonymous"
  const limited = checkAdminTryOnRateLimit(`admin-tryon:${actor}:${productId}`, 10)
  if (!limited.ok) {
    res.status(429).json({ message: "Rate limit exceeded", retry_after: limited.retryAfterSec })
    return
  }

  const parsed = patchBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() })
    return
  }

  const adParsed = AdminPostProductsProductTryOnSchema.safeParse(parsed.data)
  if (!adParsed.success) {
    res.status(400).json({ message: adParsed.error.issues[0]?.message ?? "Validation failed" })
    return
  }

  let garmentUrl: string | null = null
  try {
    if (parsed.data.try_on_enabled) {
      garmentUrl = validateTryOnGarmentUrl(parsed.data.tryon_garment_url ?? null)
      if (!garmentUrl) {
        res.status(400).json({ message: "tryon_garment_url required when try_on_enabled is true" })
        return
      }
    } else {
      garmentUrl = parsed.data.tryon_garment_url
        ? validateTryOnGarmentUrl(parsed.data.tryon_garment_url)
        : null
    }
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Invalid garment URL" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const tryOnService = req.scope.resolve<ProductTryOnModuleService>(PRODUCT_TRY_ON_MODULE)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "product_try_on.id",
      "product_try_on.try_on_enabled",
      "product_try_on.tryon_garment_url",
    ],
    filters: { id: productId },
  })

  const product = products?.[0] as
    | { id: string; handle?: string | null; product_try_on?: TryOnRecord | null }
    | undefined

  if (!product) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  const payload = {
    try_on_enabled: parsed.data.try_on_enabled,
    tryon_garment_url: garmentUrl,
  }

  let record: TryOnRecord
  const existing = product.product_try_on

  if (existing?.id) {
    const updated = await tryOnService.updateProductTryOns({ id: existing.id, ...payload })
    record = (Array.isArray(updated) ? updated[0] : updated) as TryOnRecord
  } else {
    const created = await tryOnService.createProductTryOns(payload)
    record = (Array.isArray(created) ? created[0] : created) as TryOnRecord
    await link.create({
      [Modules.PRODUCT]: { product_id: productId },
      [PRODUCT_TRY_ON_MODULE]: { product_try_on_id: record.id },
    })
  }

  console.log("[medusa-try-on]", { productId, try_on_enabled: record.try_on_enabled, result: "saved" })

  const handle = product.handle?.trim()
  if (handle) {
    try {
      const { syncTryOnToPrismaDirectWorkflow } = await import(
        "../../../../../workflows/try-on/sync-to-prisma"
      )
      await syncTryOnToPrismaDirectWorkflow(req.scope).run({
        input: {
          medusaProductId: productId,
          handle,
          try_on_enabled: record.try_on_enabled,
          tryon_garment_url: record.tryon_garment_url,
        },
      })
    } catch (err) {
      console.warn("[medusa-try-on]", {
        productId,
        handle,
        result: "prisma_sync_failed",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  res.json({
    product_try_on: record,
    try_on_enabled: record.try_on_enabled,
    tryon_garment_url: record.tryon_garment_url,
  })
}
