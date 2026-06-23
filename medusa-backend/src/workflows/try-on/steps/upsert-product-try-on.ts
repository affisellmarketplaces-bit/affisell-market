import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { PRODUCT_TRY_ON_MODULE } from "../../../modules/product-try-on"
import type ProductTryOnModuleService from "../../../modules/product-try-on/service"

export type UpsertTryOnStepInput = {
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
}

export const upsertProductTryOnStep = createStep(
  "upsert-product-try-on",
  async (data: UpsertTryOnStepInput, { container }) => {
    const hasEnabled = data.try_on_enabled !== undefined
    const hasUrl = data.tryon_garment_url !== undefined
    if (!hasEnabled && !hasUrl) {
      return new StepResponse(null, null)
    }

    const service = container.resolve<ProductTryOnModuleService>(PRODUCT_TRY_ON_MODULE)
    const payload: Record<string, unknown> = {}
    if (hasEnabled) payload.try_on_enabled = data.try_on_enabled
    if (hasUrl) payload.tryon_garment_url = data.tryon_garment_url

    const created = await service.createProductTryOns(payload)
    const record = Array.isArray(created) ? created[0] : created

    return new StepResponse(record, record?.id ?? null)
  },
  async (tryOnId, { container }) => {
    if (!tryOnId) return
    const service = container.resolve<ProductTryOnModuleService>(PRODUCT_TRY_ON_MODULE)
    await service.deleteProductTryOns(tryOnId)
  }
)
