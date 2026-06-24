import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  getAffisellPrisma,
  syncPrismaProductTryOn,
  type SyncPrismaTryOnInput,
} from "../../../lib/prisma-client"

export type PrismaSyncEvent = "product.created" | "product.updated" | "try_on.direct"

export type UpsertPrismaProductInput = {
  event: PrismaSyncEvent
  medusaProductId: string
  handle: string
  title?: string
  description?: string | null
  thumbnail?: string | null
  price_amount?: number
  currency_code?: string
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
}

export type UpsertPrismaProductResult = {
  synced: boolean
  skipped?: boolean
  created?: boolean
  handle: string
  medusaProductId: string
  updatedCount?: number
  prismaProductId?: string
}

export const upsertPrismaProductStep = createStep(
  "upsert-prisma-product",
  async (input: UpsertPrismaProductInput | null, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const log = (msg: string) => logger.info(msg)

    if (!input?.handle?.trim() || !input.medusaProductId?.trim()) {
      logger.warn(`[prisma-sync] product handle/id missing — skip`)
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle: input?.handle ?? "",
        medusaProductId: input?.medusaProductId ?? "",
      })
    }

    const handle = input.handle.trim()
    const medusaProductId = input.medusaProductId.trim()

    if (
      input.try_on_enabled !== undefined ||
      input.tryon_garment_url !== undefined ||
      input.event === "try_on.direct"
    ) {
      const tryOnResult = await syncPrismaProductTryOn(
        {
          handle,
          medusaProductId,
          try_on_enabled: input.try_on_enabled ?? false,
          tryon_garment_url: input.tryon_garment_url ?? null,
        } satisfies SyncPrismaTryOnInput,
        log
      )
      if (tryOnResult.synced) {
        return new StepResponse<UpsertPrismaProductResult>({
          synced: true,
          handle,
          medusaProductId,
          updatedCount: 1,
          prismaProductId: tryOnResult.prismaProductId,
        })
      }
    }

    const prisma = getAffisellPrisma()
    if (!prisma) {
      logger.warn(`[prisma-sync] DATABASE_URL_PRISMA missing — skip sync handle=${handle}`)
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle,
        medusaProductId,
      })
    }

    try {
      const existing = await prisma.product.findUnique({
        where: { medusaHandle: handle },
        select: { id: true },
      })

      if (existing) {
        const updated = await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...(input.title ? { name: input.title } : {}),
            ...(input.price_amount != null ? { basePriceCents: input.price_amount } : {}),
          },
        })
        logger.info(`[prisma-sync] updated Prisma product handle=${handle} prismaId=${updated.id}`)
        return new StepResponse<UpsertPrismaProductResult>({
          synced: true,
          handle,
          medusaProductId,
          updatedCount: 1,
          prismaProductId: updated.id,
        })
      }

      if (input.event !== "product.created") {
        logger.warn(`[prisma-sync] no Prisma Product for handle=${handle} — skip`)
        return new StepResponse<UpsertPrismaProductResult>({
          synced: false,
          skipped: true,
          handle,
          medusaProductId,
        })
      }

      const supplierId = process.env.MEDUSA_PRISMA_SYNC_SUPPLIER_ID?.trim()
      if (!supplierId) {
        logger.warn(`[prisma-sync] MEDUSA_PRISMA_SYNC_SUPPLIER_ID missing — cannot auto-create`)
        return new StepResponse<UpsertPrismaProductResult>({
          synced: false,
          skipped: true,
          handle,
          medusaProductId,
        })
      }

      const created = await prisma.product.create({
        data: {
          name: input.title?.trim() || handle,
          description: input.description?.trim() || input.title?.trim() || handle,
          medusaHandle: handle,
          supplierId,
          basePriceCents: input.price_amount ?? 0,
          commissionRate: 10,
          images: input.thumbnail ? [input.thumbnail] : [],
          active: true,
          isDraft: false,
          tryOnEnabled: input.try_on_enabled ?? false,
          tryOnGarmentUrl: input.tryon_garment_url ?? null,
        },
        select: { id: true },
      })

      logger.info(`Auto-created Prisma Product from Medusa: ${handle} prismaId=${created.id}`)
      return new StepResponse<UpsertPrismaProductResult>({
        synced: true,
        created: true,
        handle,
        medusaProductId,
        prismaProductId: created.id,
        updatedCount: 1,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[prisma-sync] failed handle=${handle} error=${message}`)
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle,
        medusaProductId,
      })
    }
  }
)
