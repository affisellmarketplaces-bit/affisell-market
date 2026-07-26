import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { checkStock } from "@/lib/ghost/check-stock"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BATCH = 50
const STALE_MS = 6 * 60 * 60 * 1000

/**
 * GET /api/cron/stock-check — Ghost batch probe (every 6h).
 * Auth: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const staleBefore = new Date(Date.now() - STALE_MS)
  const products = await prisma.product.findMany({
    where: {
      active: true,
      isDraft: false,
      OR: [{ lastStockCheck: null }, { lastStockCheck: { lt: staleBefore } }],
    },
    orderBy: [{ reviewCount: "desc" }, { updatedAt: "desc" }],
    take: BATCH,
    select: {
      id: true,
      name: true,
      supplierId: true,
      supplierUrl: true,
      supplierSource: true,
      supplierProductId: true,
      sourceUrl: true,
      importSource: true,
      aliexpressProductId: true,
      lastPriceSupplier: true,
      basePriceCents: true,
      stock: true,
    },
  })

  let checked = 0
  let oos = 0
  let low = 0

  for (const product of products) {
    const result = await checkStock(product)
    checked += 1

    if (result.status === "out_of_stock") {
      oos += 1
      await prisma.product.update({
        where: { id: product.id },
        data: { isDraft: true, active: false },
      })
      const owner = await prisma.user.findUnique({
        where: { id: product.supplierId },
        select: { email: true, name: true },
      })
      const config = readResendDeliveryConfig()
      if (config && owner?.email) {
        await sendResendEmail({
          context: "ghost-cron-oos",
          config,
          intendedTo: owner.email,
          subject: `Rupture Ghost — ${product.name}`,
          html: `<p>Le produit <strong>${product.name}</strong> est en rupture fournisseur (vérif Ghost cron).</p>
<p>Il a été passé en brouillon automatiquement.</p>`,
        })
      }
    } else if (result.status === "low_stock") {
      low += 1
    }
  }

  console.log("[cron/stock-check]", { checked, oos, low, result: "ok" })
  if (oos > 0) {
    void opsWebhookAlert(`[Ghost cron] ${oos} OOS / ${checked} checked`)
  }

  return NextResponse.json({ ok: true, checked, oos, low })
}
