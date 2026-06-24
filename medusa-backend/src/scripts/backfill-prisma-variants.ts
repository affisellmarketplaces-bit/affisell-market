import { setTimeout } from "node:timers/promises"

import { z } from "@medusajs/framework/zod"

import { getAffisellPrisma } from "../lib/prisma-client"

const MedusaProductSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      variants: z.array(z.object({ id: z.string() })),
    })
  ),
})

function medusaBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.trim() ||
    "http://localhost:9000"
  ).replace(/\/$/, "")
}

function publishableKey(): string | null {
  return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim() || null
}

async function backfillPrismaVariants(): Promise<void> {
  const prisma = getAffisellPrisma()
  if (!prisma) {
    console.error("[medusa] DATABASE_URL_PRISMA missing — abort")
    return
  }

  const pk = publishableKey()
  if (!pk) {
    console.error("[medusa] NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY missing — abort")
    return
  }

  const products = await prisma.product.findMany({
    where: { medusaHandle: { not: null }, medusaVariantId: null },
    select: { id: true, name: true, medusaHandle: true },
  })

  console.log(`[medusa] Found ${products.length} products to backfill`)

  for (const p of products) {
    const handle = p.medusaHandle?.trim()
    if (!handle) continue

    try {
      const params = new URLSearchParams({
        handle,
        fields: "id,variants.id",
        limit: "1",
      })
      const res = await fetch(`${medusaBackendUrl()}/store/products?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "x-publishable-api-key": pk,
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = MedusaProductSchema.parse(await res.json())
      const variantId = data.products[0]?.variants[0]?.id
      if (!variantId) throw new Error("No variant found")

      await prisma.product.update({
        where: { id: p.id },
        data: { medusaVariantId: variantId },
      })
      console.log(`[medusa] ✅ ${p.name} → ${variantId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[medusa] ⚠️ ${handle}: ${msg}`)
    }

    await setTimeout(100)
  }
}

export default async function backfillPrismaVariantsScript() {
  await backfillPrismaVariants()
}
