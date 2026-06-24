import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { syncProductToPrismaWorkflow } from "../workflows/try-on/sync-to-prisma"

type MedusaProductRow = {
  id: string
  handle?: string
  title?: string
  description?: string | null
  thumbnail?: string | null
  variants?: Array<{
    prices?: Array<{ amount?: number; currency_code?: string }>
  }>
}

export default async function backfillPrismaProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  if (!process.env.DATABASE_URL_PRISMA?.trim()) {
    logger.warn("[backfill-prisma] DATABASE_URL_PRISMA missing — abort")
    return
  }

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "description",
      "thumbnail",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
  })

  const products = (data ?? []) as MedusaProductRow[]
  logger.info(`[backfill-prisma] syncing ${products.length} Medusa products`)

  let synced = 0
  let skipped = 0

  for (const product of products) {
    const handle = product.handle?.trim()
    if (!handle) {
      skipped += 1
      continue
    }
    const price = product.variants?.[0]?.prices?.[0]
    const { result: workflowOut } = await syncProductToPrismaWorkflow(container).run({
      input: {
        product: {
          id: product.id,
          handle,
          title: product.title ?? handle,
          description: product.description ?? null,
          thumbnail: product.thumbnail ?? null,
        },
        event: "product.created",
        price_amount: price?.amount,
        currency_code: price?.currency_code ?? "eur",
      },
    })
    const row = (workflowOut as { result?: { synced?: boolean } } | null)?.result
    if (row?.synced) synced += 1
    else skipped += 1
  }

  logger.info(`[backfill-prisma] done synced=${synced} skipped=${skipped}`)
}
