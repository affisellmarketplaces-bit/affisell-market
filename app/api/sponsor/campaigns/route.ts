import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const campaigns = await prisma.sponsorCampaign.findMany({
    where: { payerUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      payerRole: true,
      productId: true,
      affiliateProductId: true,
      sponsorRateBps: true,
      htCentsSnapshot: true,
      feeCents: true,
      durationDays: true,
      placement: true,
      status: true,
      boostScore: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      product: { select: { name: true, images: true } },
      affiliateProduct: {
        select: { customTitle: true, product: { select: { name: true } } },
      },
    },
  })

  return NextResponse.json({ campaigns })
}
