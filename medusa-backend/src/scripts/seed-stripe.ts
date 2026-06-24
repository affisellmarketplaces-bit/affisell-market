import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows"

const STRIPE_PROVIDER = "pp_stripe_stripe"

export default async function seedStripe({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "payment_providers.id"],
  })

  type RegionRow = {
    id: string
    name?: string
    payment_providers?: Array<{ id?: string }>
  }

  const rows = (regions ?? []) as RegionRow[]
  let region = rows.find((r) => r.name === "EU" || r.name === "Europe")

  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "EU",
            currency_code: "eur",
            countries: ["fr", "de", "es", "it", "be", "nl"],
            payment_providers: [STRIPE_PROVIDER],
          },
        ],
      },
    })
    logger.info(`[seed-stripe] created EU region ${result[0]?.id}`)
    return
  }

  const providerIds = (region.payment_providers ?? [])
    .map((p) => p.id)
    .filter((id): id is string => Boolean(id))

  if (providerIds.includes(STRIPE_PROVIDER)) {
    logger.info(`[seed-stripe] stripe already linked to region ${region.id}`)
    return
  }

  await updateRegionsWorkflow(container).run({
    input: {
      selector: { id: region.id },
      update: {
        payment_providers: [...providerIds, STRIPE_PROVIDER],
      },
    },
  })

  logger.info(`[seed-stripe] linked ${STRIPE_PROVIDER} to region ${region.id}`)
}
