import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getAffisellPrisma } from "../../../lib/prisma-client"

export type UpsertPrismaProductInput = {
  handle: string
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
}

export type UpsertPrismaProductResult = {
  synced: boolean
  skipped?: boolean
  handle: string
  updatedCount?: number
}

export const upsertPrismaProductStep = createStep(
  "upsert-prisma-product",
  async (input: UpsertPrismaProductInput | null, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    if (!input?.handle?.trim()) {
      logger.warn("[prisma-sync] product handle missing — skip")
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle: "",
      })
    }

    const handle = input.handle.trim()
    const prisma = getAffisellPrisma()
    if (!prisma) {
      logger.warn("[prisma-sync] DATABASE_URL_PRISMA missing — skip sync")
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle,
      })
    }

    const data = {
      tryOnEnabled: input.try_on_enabled ?? false,
      tryOnGarmentUrl: input.tryon_garment_url ?? null,
    }

    try {
      let updated = await prisma.product.updateMany({
        where: { medusaHandle: handle },
        data,
      })

      if (updated.count === 0) {
        const slugLike = handle.replace(/-/g, " ")
        updated = await prisma.product.updateMany({
          where: {
            medusaHandle: null,
            name: { contains: slugLike, mode: "insensitive" },
          },
          data: { medusaHandle: handle, ...data },
        })
      }

      if (updated.count === 0) {
        logger.warn(`[prisma-sync] no Prisma Product for medusa handle "${handle}" — skip`)
        return new StepResponse<UpsertPrismaProductResult>({
          synced: false,
          skipped: true,
          handle,
          updatedCount: 0,
        })
      }

      logger.info(`Synced Try-On to Prisma: ${handle}`)
      return new StepResponse<UpsertPrismaProductResult>({
        synced: true,
        handle,
        updatedCount: updated.count,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn(`[prisma-sync] failed for "${handle}": ${message}`)
      return new StepResponse<UpsertPrismaProductResult>({
        synced: false,
        skipped: true,
        handle,
      })
    }
  }
)
