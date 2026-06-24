import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { ProductDTO } from "@medusajs/framework/types"

import {
  upsertPrismaProductStep,
  type UpsertPrismaProductInput,
} from "./steps/upsert-prisma-product"
import type { TryOnAdditionalData } from "./sync-try-on-from-product"

export type SyncTryOnToPrismaInput = {
  product: ProductDTO
  additional_data?: TryOnAdditionalData
}

export type SyncTryOnToPrismaDirectInput = UpsertPrismaProductInput

/** Sync Medusa try-on flags → Affisell Prisma Product (by medusa handle). */
export const syncTryOnToPrismaWorkflow = createWorkflow(
  "sync-try-on-to-prisma",
  (input: SyncTryOnToPrismaInput) => {
    const payload = transform({ input }, ({ input: i }) => {
      const ad = i.additional_data
      if (!ad) return null
      if (ad.try_on_enabled === undefined && ad.tryon_garment_url === undefined) {
        return null
      }
      const handle = i.product.handle?.trim()
      if (!handle) return null
      return {
        handle,
        try_on_enabled: ad.try_on_enabled,
        tryon_garment_url: ad.tryon_garment_url ?? null,
      } satisfies UpsertPrismaProductInput
    })

    const result = upsertPrismaProductStep(payload)
    return new WorkflowResponse({ result })
  }
)

/** Direct sync when try-on values are already resolved (admin try-on widget route). */
export const syncTryOnToPrismaDirectWorkflow = createWorkflow(
  "sync-try-on-to-prisma-direct",
  (input: SyncTryOnToPrismaDirectInput) => {
    const result = upsertPrismaProductStep(input)
    return new WorkflowResponse({ result })
  }
)

export function hasTryOnAdditionalData(
  additional_data?: TryOnAdditionalData | null
): additional_data is TryOnAdditionalData {
  if (!additional_data) return false
  return (
    additional_data.try_on_enabled !== undefined ||
    additional_data.tryon_garment_url !== undefined
  )
}
