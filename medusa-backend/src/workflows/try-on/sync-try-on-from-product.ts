import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import type { ProductDTO } from "@medusajs/framework/types"
import { createRemoteLinkStep, dismissRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"

import { PRODUCT_TRY_ON_MODULE } from "../../modules/product-try-on"
import { upsertProductTryOnStep } from "./steps/upsert-product-try-on"

export type TryOnAdditionalData = {
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
}

export type SyncTryOnFromProductInput = {
  product: ProductDTO
  additional_data?: TryOnAdditionalData
}

export const syncTryOnFromProductWorkflow = createWorkflow(
  "sync-try-on-from-product",
  (input: SyncTryOnFromProductInput) => {
    const tryOnPayload = transform({ input }, ({ input: i }) => {
      const ad = i.additional_data
      if (!ad) return null
      if (ad.try_on_enabled === undefined && ad.tryon_garment_url === undefined) {
        return null
      }
      return {
        try_on_enabled: ad.try_on_enabled ?? false,
        tryon_garment_url: ad.tryon_garment_url ?? null,
      }
    })

    const tryOnRecord = upsertProductTryOnStep(tryOnPayload)

    when({ tryOnRecord }, ({ tryOnRecord: rec }) => rec != null).then(() => {
      createRemoteLinkStep([
        {
          [Modules.PRODUCT]: { product_id: input.product.id },
          [PRODUCT_TRY_ON_MODULE]: { product_try_on_id: tryOnRecord.id },
        },
      ])
    })

    return new WorkflowResponse({ tryOnRecord })
  }
)

export const updateTryOnFromProductWorkflow = createWorkflow(
  "update-try-on-from-product",
  (input: SyncTryOnFromProductInput) => {
    const tryOnPayload = transform({ input }, ({ input: i }) => i.additional_data ?? null)
    const tryOnRecord = upsertProductTryOnStep(tryOnPayload ?? {})

    when({ tryOnRecord }, ({ tryOnRecord: rec }) => rec != null).then(() => {
      createRemoteLinkStep([
        {
          [Modules.PRODUCT]: { product_id: input.product.id },
          [PRODUCT_TRY_ON_MODULE]: { product_try_on_id: tryOnRecord.id },
        },
      ])
    })

    return new WorkflowResponse({ tryOnRecord })
  }
)

export const unlinkTryOnFromProductWorkflow = createWorkflow(
  "unlink-try-on-from-product",
  (input: { product_id: string; try_on_id: string }) => {
    dismissRemoteLinkStep({
      [Modules.PRODUCT]: { product_id: input.product_id },
      [PRODUCT_TRY_ON_MODULE]: { product_try_on_id: input.try_on_id },
    })
    return new WorkflowResponse({ ok: true })
  }
)
