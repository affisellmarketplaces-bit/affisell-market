/**
 * Re-run Connect settlement for a checkout session (local fix / after resend webhook).
 *
 * Run: npx tsx scripts/resettle-order-vat.ts cs_test_…
 */
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { settleMarketplaceOrdersFromCheckoutSession } from "../lib/stripe-marketplace-commission-split"
import { prisma } from "../lib/prisma"

const sessionId = process.argv[2]?.trim()

async function main() {
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/resettle-order-vat.ts <checkout_session_id>")
    process.exit(1)
  }

  const result = await settleMarketplaceOrdersFromCheckoutSession(sessionId)
  console.log("settlement:", result)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
