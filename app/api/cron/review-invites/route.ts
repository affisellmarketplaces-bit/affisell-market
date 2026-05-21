import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL?.trim() || "Affisell <onboarding@resend.dev>"
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://affisell.com"

/**
 * Call from Vercel cron: orders delivered 3+ days ago without review reminder.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 3)

  const orders = await prisma.order.findMany({
    where: {
      deliveredAt: { lte: cutoff, not: null },
      buyerUserId: { not: null },
      reviewReminderSentAt: null,
      buyerReview: null,
    },
    take: 50,
    include: {
      buyer: { select: { email: true, name: true } },
      product: { select: { id: true, name: true } },
      affiliateProduct: { select: { id: true } },
    },
  })

  let sent = 0
  for (const order of orders) {
    const email = order.buyer?.email
    if (!email || !order.affiliateProduct?.id) continue

    const listingUrl = `${SITE.replace(/\/$/, "")}/marketplace/${order.affiliateProduct.id}?writeReview=true&orderId=${order.id}`

    if (resend) {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Comment s'est passé votre achat ?",
        html: `
          <p>Bonjour${order.buyer?.name ? ` ${order.buyer.name}` : ""},</p>
          <p>Votre commande <strong>${order.product.name}</strong> a été livrée. Partagez un avis en 1 clic — photos et vidéos bienvenues.</p>
          <p><a href="${listingUrl}" style="display:inline-block;padding:12px 20px;background:#6d28d9;color:#fff;border-radius:12px;text-decoration:none;font-weight:600">Laisser un avis →</a></p>
          <p style="color:#64748b;font-size:12px">Affisell · Trust Engine</p>
        `,
      })
      sent += 1
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { reviewReminderSentAt: new Date() },
    })
  }

  return NextResponse.json({ processed: orders.length, sent })
}
