import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getAffisellPrisma } from "../../../lib/prisma-client"

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

function buildTryOnData(input: UpsertPrismaProductInput) {
  return {
    tryOnEnabled: input.try_on_enabled ?? false,
    tryOnGarmentUrl: input.tryon_garment_url ?? null,
  }
}

export const upsertPrismaProductStep = createStep(
  "upsert-prisma-product",
  async (input: UpsertPrismaProductInput | null, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    if (!input?.handle?.trim() || !input.medusaProductId?.trim()) {
      logger.warn(
        `[prisma-sync] product handle/id missing — skip handle=${input?.handle ?? ""} medusaProductId=${input?.medusaProductId ?? ""}`
      )
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle: input?.handle ?? "",
        medusaProductId: input?.medusaProductId ?? "",
      })
    }

    const handle = input.handle.trim()
    const medusaProductId = input.medusaProductId.trim()
    const prisma = getAffisellPrisma()

    if (!prisma) {
      logger.warn(
        `[prisma-sync] DATABASE_URL_PRISMA missing — skip sync handle=${handle} medusaProductId=${medusaProductId}`
      )
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle,
        medusaProductId,
      })
    }

    const tryOnData = buildTryOnData(input)

    try {
      const existing = await prisma.product.findUnique({
        where: { medusaHandle: handle },
        select: { id: true },
      })

      if (existing) {
        const updated = await prisma.product.update({
          where: { id: existing.id },
          data: {
            ...tryOnData,
            ...(input.title ? { name: input.title } : {}),
            ...(input.price_amount != null ? { basePriceCents: input.price_amount } : {}),
          },
        })
        logger.info(
          `[prisma-sync] updated Prisma product handle=${handle} medusaProductId=${medusaProductId} prismaProductId=${updated.id} event=${input.event}`
        )
        return new StepResponse<UpsertPrismaProductResult>({
          synced: true,
          handle,
          medusaProductId,
          updatedCount: 1,
          prismaProductId: updated.id,
        })
      }

      if (input.event !== "product.created") {
        const slugLike = handle.replace(/-/g, " ")
        const fallback = await prisma.product.updateMany({
          where: {
            medusaHandle: null,
            name: { contains: slugLike, mode: "insensitive" },
          },
          data: { medusaHandle: handle, ...tryOnData },
        })
        if (fallback.count > 0) {
          logger.info(
            `[prisma-sync] linked existing Prisma product by name handle=${handle} medusaProductId=${medusaProductId} updatedCount=${fallback.count}`
          )
          return new StepResponse<UpsertPrismaProductResult>({
            synced: true,
            handle,
            medusaProductId,
            updatedCount: fallback.count,
          })
        }
        logger.warn(
          `[prisma-sync] no Prisma Product for handle — skip update handle=${handle} medusaProductId=${medusaProductId} event=${input.event}`
        )
        return new StepResponse<UpsertPrismaProductResult>({
          synced: false,
          skipped: true,
          handle,
          medusaProductId,
          updatedCount: 0,
        })
      }

      const supplierId = process.env.MEDUSA_PRISMA_SYNC_SUPPLIER_ID?.trim()
      if (!supplierId) {
        logger.warn(
          `[prisma-sync] MEDUSA_PRISMA_SYNC_SUPPLIER_ID missing — cannot auto-create handle=${handle} medusaProductId=${medusaProductId}`
        )
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
          ...tryOnData,
        },
        select: { id: true },
      })

      logger.info(
        `Auto-created Prisma Product from Medusa: ${handle} medusaProductId=${medusaProductId} prismaProductId=${created.id}`
      )

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
      logger.error(
        `[prisma-sync] failed for handle=${handle} medusaProductId=${medusaProductId} event=${input.event} error=${message}`
      )
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle,
        medusaProductId,
      })
    }
  }
)
