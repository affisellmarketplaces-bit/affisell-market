import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { handleStripeCommissionSplit } from "../lib/stripe-marketplace-commission-split"
import { prisma } from "../lib/prisma"

const orderId = process.argv[2]
if (!orderId) throw new Error("Usage: npx tsx scripts/settle-order.ts <orderId>")

async function main() {
  const fakeSession = { id: "cs_test_" + Date.now() } as Parameters<
    typeof handleStripeCommissionSplit
  >[0]
  await handleStripeCommissionSplit(fakeSession, orderId)
}

main().catch(console.error).finally(() => prisma.$disconnect())
