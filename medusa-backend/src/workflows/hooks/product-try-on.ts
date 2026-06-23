import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import {
  syncTryOnFromProductWorkflow,
  type SyncTryOnFromProductInput,
} from "../try-on/sync-try-on-from-product"

createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    const workflow = syncTryOnFromProductWorkflow(container)
    for (const product of products) {
      if (!additional_data) continue
      await workflow.run({
        input: { product, additional_data } satisfies SyncTryOnFromProductInput,
      })
    }
  }
)

updateProductsWorkflow.hooks.productsUpdated(
  async ({ products, additional_data }, { container }) => {
    const workflow = syncTryOnFromProductWorkflow(container)
    for (const product of products) {
      if (!additional_data) continue
      await workflow.run({
        input: { product, additional_data } satisfies SyncTryOnFromProductInput,
      })
    }
  }
)
