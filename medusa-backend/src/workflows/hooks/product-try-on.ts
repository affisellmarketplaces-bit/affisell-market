import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import {
  syncTryOnFromProductWorkflow,
  type SyncTryOnFromProductInput,
} from "../try-on/sync-try-on-from-product"
import {
  hasTryOnAdditionalData,
  syncTryOnToPrismaWorkflow,
} from "../try-on/sync-to-prisma"

async function runTryOnSyncs(
  container: { resolve: (key: string) => unknown },
  product: SyncTryOnFromProductInput["product"],
  additional_data?: SyncTryOnFromProductInput["additional_data"]
): Promise<void> {
  if (!hasTryOnAdditionalData(additional_data)) return

  await syncTryOnFromProductWorkflow(container).run({
    input: { product, additional_data } satisfies SyncTryOnFromProductInput,
  })

  await syncTryOnToPrismaWorkflow(container).run({
    input: { product, additional_data },
  })
}

createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    for (const product of products) {
      await runTryOnSyncs(container, product, additional_data)
    }
  }
)

updateProductsWorkflow.hooks.productsUpdated(
  async ({ products, additional_data }, { container }) => {
    for (const product of products) {
      await runTryOnSyncs(container, product, additional_data)
    }
  }
)
