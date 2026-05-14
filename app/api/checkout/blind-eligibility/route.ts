import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        affiliateProductId: z.string().min(1),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(50),
})

/** Validates cart lines for blind dropship (wholesale + SKU + supplier profile). */
export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as unknown
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const lines: {
    affiliateProductId: string
    qty: number
    eligible: boolean
    reason?: string
    supplierSku?: string | null
    supplierWholesaleCents?: number | null
  }[] = []

  let allEligible = true

  for (const row of parsed.data.items) {
    const listing = await prisma.affiliateProduct.findFirst({
      where: {
        id: row.affiliateProductId,
        isListed: true,
        product: { active: true },
        affiliate: { role: "AFFILIATE" },
      },
      include: {
        product: { select: { id: true, supplierSku: true, supplierWholesaleCents: true, supplierId: true } },
      },
    })
    if (!listing) {
      allEligible = false
      lines.push({
        affiliateProductId: row.affiliateProductId,
        qty: row.qty,
        eligible: false,
        reason: "listing_not_found",
      })
      continue
    }
    const p = listing.product
    const skuOk = Boolean(p.supplierSku?.trim())
    const priceOk = p.supplierWholesaleCents != null && p.supplierWholesaleCents >= 0
    const blind = await prisma.blindDropshipSupplier.findUnique({
      where: { linkedUserId: p.supplierId },
      select: { id: true, isBlindDropship: true, apiType: true },
    })
    const profileOk = Boolean(blind?.isBlindDropship && blind.apiType === "rest")
    const eligible = skuOk && priceOk && profileOk
    if (!eligible) allEligible = false
    let reason: string | undefined
    if (!eligible) {
      if (!skuOk) reason = "missing_supplier_sku"
      else if (!priceOk) reason = "missing_supplier_wholesale"
      else if (!profileOk) reason = "missing_blind_supplier_profile"
    }
    lines.push({
      affiliateProductId: row.affiliateProductId,
      qty: row.qty,
      eligible,
      reason,
      supplierSku: p.supplierSku,
      supplierWholesaleCents: p.supplierWholesaleCents,
    })
  }

  return NextResponse.json({ allEligible, lines })
}
