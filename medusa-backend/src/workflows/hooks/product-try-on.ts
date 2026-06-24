import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import {
  syncTryOnFromProductWorkflow,
  type SyncTryOnFromProductInput,
} from "../try-on/sync-try-on-from-product"
import {
  hasTryOnAdditionalData,
  resolveProductPriceFromContainer,
  syncProductToPrismaWorkflow,
  syncTryOnToPrismaWorkflow,
} from "../try-on/sync-to-prisma"

type HookContainer = { resolve: (key: string) => unknown }

async function runTryOnMedusaSyncs(
  container: HookContainer,
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

async function runPrismaProductCreateSync(
  container: HookContainer,
  product: SyncTryOnFromProductInput["product"],
  additional_data?: SyncTryOnFromProductInput["additional_data"]
): Promise<void> {
  const price = await resolveProductPriceFromContainer(container, product.id)
  await syncProductToPrismaWorkflow(container).run({
    input: {
      product,
      additional_data,
      event: "product.created",
      price_amount: price?.amount,
      currency_code: price?.currency_code,
    },
  })
}

async function runPrismaProductUpdateSync(
  container: HookContainer,
  product: SyncTryOnFromProductInput["product"],
  additional_data?: SyncTryOnFromProductInput["additional_data"]
): Promise<void> {
  const price = await resolveProductPriceFromContainer(container, product.id)
  await syncProductToPrismaWorkflow(container).run({
    input: {
      product,
      additional_data,
      event: "product.updated",
      price_amount: price?.amount,
      currency_code: price?.currency_code,
    },
  })
}

createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    for (const product of products) {
      await runTryOnMedusaSyncs(container, product, additional_data)
      await runPrismaProductCreateSync(container, product, additional_data)
    }
  }
)

updateProductsWorkflow.hooks.productsUpdated(
  async ({ products, additional_data }, { container }) => {
    for (const product of products) {
      await runTryOnMedusaSyncs(container, product, additional_data)
      await runPrismaProductUpdateSync(container, product, additional_data)
    }
  }
)
