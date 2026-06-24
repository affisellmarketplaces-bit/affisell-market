import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRegionsWorkflow } from "@medusajs/medusa/core-flows"

const REGION_NAME = "Europe"
const STRIPE_PROVIDER = "pp_stripe_stripe"
const EU_COUNTRIES = ["fr", "de", "es", "it", "be", "nl", "pt", "at", "ie", "lu"]

type RegionRow = {
  id: string
  name?: string
  currency_code?: string
}

export default async function seedRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
  })

  const existing = ((regions ?? []) as RegionRow[]).find(
    (r) => r.name === REGION_NAME || r.name === "EU"
  )
  if (existing) {
    logger.info(`[seed-region] region exists name=${existing.name} id=${existing.id}`)
    console.log(`✅ Region ID: ${existing.id}`)
    console.log(`MEDUSA_REGION_ID=${existing.id}`)
    return
  }

  const paymentProviders = process.env.STRIPE_API_KEY?.trim() ? [STRIPE_PROVIDER] : []

  const { result } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: REGION_NAME,
          currency_code: "eur",
          countries: EU_COUNTRIES,
          automatic_taxes: true,
          ...(paymentProviders.length ? { payment_providers: paymentProviders } : {}),
        },
      ],
    },
  })

  const region = result[0]
  if (!region?.id) {
    logger.error("[seed-region] create failed — no region returned")
    return
  }

  logger.info(`[seed-region] created ${REGION_NAME} id=${region.id}`)
  console.log(`✅ Region ID: ${region.id}`)
  console.log(`MEDUSA_REGION_ID=${region.id}`)
}
