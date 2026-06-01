import { Resend } from "resend"

import {
  readResendDeliveryConfig,
  resendSandboxNeedsTestInbox,
  resolveResendDeliveryRecipient,
} from "@/lib/emails/resend-delivery"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


function dropPercent(current: number, previous: number | null): number {
  if (!previous || previous <= 0 || current >= previous) return 0
  return Math.max(1, Math.round(((previous - current) / previous) * 100))
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const authHeader = req.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const rows = await prisma.wishlist.findMany({
    take: 500,
    include: {
      user: { select: { email: true, name: true } },
      product: {
        select: {
          id: true,
          name: true,
          affiliateProducts: {
            where: buyerListedAffiliateProductWhere,
            take: 1,
            orderBy: { id: "asc" },
            select: { id: true, sellingPriceCents: true },
          },
        },
      },
    },
  })

  const resendConfig = readResendDeliveryConfig()
  const resend = resendConfig ? new Resend(resendConfig.apiKey) : null
  const sandboxBlocked = resendConfig ? resendSandboxNeedsTestInbox(resendConfig) : true
  let emailsSent = 0
  let updates = 0

  for (const w of rows) {
    const listing = w.product.affiliateProducts[0]
    if (!listing) continue
    const current = listing.sellingPriceCents
    const sinceYesterday = dropPercent(current, w.previousPriceCents)
    const reachedTarget = w.targetPriceCents != null && current <= w.targetPriceCents
    const shouldAlert = sinceYesterday > 0 || reachedTarget

    if (shouldAlert && resend && resendConfig && !sandboxBlocked && w.user.email) {
      const pct = sinceYesterday > 0 ? ` (-${sinceYesterday}% depuis hier)` : ""
      const targetLine =
        w.targetPriceCents != null
          ? `<p>Votre prix cible: <strong>${(w.targetPriceCents / 100).toFixed(2)} EUR</strong></p>`
          : ""
      const { to } = resolveResendDeliveryRecipient("wishlist-price-alert", w.user.email, resendConfig)
      await resend.emails.send({
        from: resendConfig.from,
        to,
        subject: `Baisse de prix: ${w.product.name}`,
        html: `<p>Bonjour ${w.user.name?.trim() || ""},</p>
<p>Le produit <strong>${w.product.name}</strong> a baissé${pct}.</p>
<p>Prix actuel: <strong>${(current / 100).toFixed(2)} EUR</strong></p>
${targetLine}
<p><a href="${process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"}/marketplace/${listing.id}">Voir le produit</a></p>`,
      })
      emailsSent++
    }

    await prisma.wishlist.update({
      where: { userId_productId: { userId: w.userId, productId: w.productId } },
      data: { previousPriceCents: current },
    })
    updates++
  }

  return Response.json({ ok: true, updates, emailsSent })
}
