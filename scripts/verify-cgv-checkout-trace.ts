/**
 * Valide la trace CGV post-checkout sur une commande (fulfill simulé).
 * Crée d'abord une commande : npx tsx scripts/prepare-lightning-e2e-test.ts --new-checkout
 *
 *   npx tsx scripts/verify-cgv-checkout-trace.ts <orderId>
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import { PrismaClient } from "@prisma/client"

const EXPECTED_CGV_VERSION_ID = "cmrdpmy3m000jthnpnq2ox0em"
const EXPECTED_CGV_HASH =
  "652b0e845c7153c225e95cdfb0532de95a4026607b3ff382a4803fca150e43b4"

const prisma = new PrismaClient()

async function attachCgvTrace(args: {
  orderId: string
  userId?: string | null
  buyerEmail: string
}) {
  const version = await prisma.legalVersion.findFirst({
    where: {
      id: EXPECTED_CGV_VERSION_ID,
      document: { slug: "terms-of-sale" },
    },
    select: { id: true, contentHash: true },
  })
  if (!version) throw new Error("CGV v1.0.0 FR introuvable en DB")

  const idempotencyKey = `order:${args.orderId}:terms-of-sale`
  const acceptedAt = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.legalAcceptance.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        userId: args.userId ?? null,
        documentVersionId: version.id,
        acceptedAt,
        ip: "stripe:checkout",
        userAgent: "stripe:webhook",
        context: "CHECKOUT",
        orderId: args.orderId,
        buyerEmail: args.buyerEmail,
        idempotencyKey,
      },
    })

    await tx.order.update({
      where: { id: args.orderId },
      data: {
        status: "paid",
        paidAt: acceptedAt,
        cgvVersionId: version.id,
        cgvAcceptedAt: acceptedAt,
        buyerUserId: args.userId ?? undefined,
        customerEmail: args.buyerEmail,
      },
    })
  })

  return version
}

async function queryTrace(orderId: string) {
  return prisma.$queryRaw<
    Array<{
      id: string
      cgvVersionId: string | null
      contentHash: string | null
      context: string | null
      orderId: string | null
    }>
  >`
SELECT o.id, o."cgvVersionId", lv."contentHash", la.context, la."orderId"
FROM "Order" o
LEFT JOIN "LegalVersion" lv ON o."cgvVersionId" = lv.id
LEFT JOIN "LegalAcceptance" la ON la."orderId" = o.id AND la.context = 'CHECKOUT'
WHERE o.id = ${orderId}
`
}

async function main() {
  const orderId = process.argv[2]?.trim()
  if (!orderId) {
    console.error("Usage: npx tsx scripts/verify-cgv-checkout-trace.ts <orderId>")
    process.exit(1)
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, customerEmail: true, buyerUserId: true },
  })
  if (!order) throw new Error(`Order not found: ${orderId}`)

  const buyer = await prisma.user.findUnique({
    where: { email: "demo-buyer@demo.affisell.com" },
    select: { id: true, email: true },
  })

  console.log("[verify-cgv-checkout]", {
    orderId,
    orderStatusBefore: order.status,
    buyer: buyer?.email,
    step: "attach_cgv_checkout",
  })

  const version = await attachCgvTrace({
    orderId,
    userId: buyer?.id ?? order.buyerUserId,
    buyerEmail: buyer?.email ?? order.customerEmail ?? "demo-buyer@demo.affisell.com",
  })

  const row = (await queryTrace(orderId))[0]
  const ok =
    row?.cgvVersionId === EXPECTED_CGV_VERSION_ID &&
    row?.contentHash === EXPECTED_CGV_HASH &&
    row?.context === "CHECKOUT" &&
    version.contentHash === EXPECTED_CGV_HASH

  console.log("[verify-cgv-checkout]", {
    order: row,
    expected: { cgvVersionId: EXPECTED_CGV_VERSION_ID, contentHash: EXPECTED_CGV_HASH },
    ok,
  })

  if (!ok) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error("[verify-cgv-checkout]", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
