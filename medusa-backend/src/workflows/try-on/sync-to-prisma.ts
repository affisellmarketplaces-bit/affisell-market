import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { ProductDTO, MedusaContainer } from "@medusajs/framework/types"

import {
  upsertPrismaProductStep,
  type PrismaSyncEvent,
  type UpsertPrismaProductInput,
} from "./steps/upsert-prisma-product"
import type { TryOnAdditionalData } from "./sync-try-on-from-product"

/** Fields read by Prisma sync — narrower than full ProductDTO for backfill scripts. */
export type PrismaSyncProductRef = Pick<
  ProductDTO,
  "id" | "handle" | "title" | "description" | "thumbnail"
>

export type SyncProductToPrismaInput = {
  product: PrismaSyncProductRef
  additional_data?: TryOnAdditionalData
  event: PrismaSyncEvent
  price_amount?: number
  currency_code?: string
}

export type SyncTryOnToPrismaDirectInput = Omit<UpsertPrismaProductInput, "event"> & {
  event?: "try_on.direct"
}

function pickTryOnFields(additional_data?: TryOnAdditionalData) {
  if (!additional_data) return {}
  return {
    try_on_enabled: additional_data.try_on_enabled,
    tryon_garment_url: additional_data.tryon_garment_url ?? null,
  }
}

/** Sync full Medusa product → Affisell Prisma Product (create on product.created). */
export const syncProductToPrismaWorkflow = createWorkflow(
  "sync-product-to-prisma",
  (input: SyncProductToPrismaInput) => {
    const payload = transform({ input }, ({ input: i }) => {
      const handle = i.product.handle?.trim()
      if (!handle) return null
      const tryOn = pickTryOnFields(i.additional_data)
      return {
        event: i.event,
        medusaProductId: i.product.id,
        handle,
        title: i.product.title,
        description: i.product.description,
        thumbnail: i.product.thumbnail,
        price_amount: i.price_amount,
        currency_code: i.currency_code ?? "eur",
        ...tryOn,
      } satisfies UpsertPrismaProductInput
    })

    const result = upsertPrismaProductStep(payload)
    return new WorkflowResponse({ result })
  }
)

/** Legacy try-on-only sync (additional_data on create/update). */
export const syncTryOnToPrismaWorkflow = createWorkflow(
  "sync-try-on-to-prisma",
  (input: { product: PrismaSyncProductRef; additional_data?: TryOnAdditionalData }) => {
    const payload = transform({ input }, ({ input: i }) => {
      const ad = i.additional_data
      if (!ad) return null
      if (ad.try_on_enabled === undefined && ad.tryon_garment_url === undefined) {
        return null
      }
      const handle = i.product.handle?.trim()
      if (!handle) return null
      return {
        event: "product.updated" as const,
        medusaProductId: i.product.id,
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
    const payload = transform({ input }, ({ input: i }) => ({
      event: "try_on.direct" as const,
      medusaProductId: i.medusaProductId,
      handle: i.handle,
      try_on_enabled: i.try_on_enabled,
      tryon_garment_url: i.tryon_garment_url ?? null,
    }))
    const result = upsertPrismaProductStep(payload)
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

export async function resolveProductPriceFromContainer(
  container: MedusaContainer,
  productId: string
): Promise<{ amount: number; currency_code: string } | null> {
  const { ContainerRegistrationKeys } = await import("@medusajs/framework/utils")
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data?: unknown[] }>
  }
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "variants.prices.amount", "variants.prices.currency_code"],
    filters: { id: productId },
  })
  const row = data?.[0] as
    | {
        variants?: Array<{ prices?: Array<{ amount?: number; currency_code?: string }> }>
      }
    | undefined
  const price = row?.variants?.[0]?.prices?.[0]
  if (price?.amount == null) return null
  return {
    amount: price.amount,
    currency_code: price.currency_code ?? "eur",
  }
}
