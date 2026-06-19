#!/usr/bin/env npx tsx
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) config({ path, override: true })
}

import { prisma } from "@/lib/prisma"

async function main() {
  const pending = await prisma.order.findMany({
    where: { status: "PENDING", stripeSessionId: { startsWith: "cs_" } },
    select: {
      id: true,
      stripeSessionId: true,
      affiliateProductId: true,
      createdAt: true,
      product: { select: { active: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  console.log("[diagnose-pending]", {
    count: await prisma.order.count({
      where: { status: "PENDING", stripeSessionId: { startsWith: "cs_" } },
    }),
    sample: pending.map((o) => ({
      id: o.id,
      stripeSessionId: o.stripeSessionId,
      affiliateProductId: o.affiliateProductId,
      productActive: o.product?.active ?? null,
      productName: o.product?.name ?? null,
      ageMin: Math.round((Date.now() - o.createdAt.getTime()) / 60_000),
    })),
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
