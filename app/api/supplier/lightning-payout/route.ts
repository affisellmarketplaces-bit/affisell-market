import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { calculateTrustScoreBreakdown } from "@/lib/trust-score"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  lightningEnabled: z.boolean(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supplierId = session.user.id
  const breakdown = await calculateTrustScoreBreakdown(supplierId)

  const profile = await prisma.supplierProfile.upsert({
    where: { userId: supplierId },
    create: {
      userId: supplierId,
      trustScore: breakdown.score,
      lightningEnabled: false,
    },
    update: { trustScore: breakdown.score },
    select: { lightningEnabled: true, trustScore: true },
  })

  return NextResponse.json({
    trustScore: profile.trustScore,
    lightningEnabled: profile.lightningEnabled,
    breakdown,
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const supplierId = session.user.id
  const breakdown = await calculateTrustScoreBreakdown(supplierId)

  if (parsed.data.lightningEnabled && breakdown.score < 50) {
    return NextResponse.json(
      {
        error: "trust_score_too_low",
        trustScore: breakdown.score,
      },
      { status: 403 }
    )
  }

  const profile = await prisma.supplierProfile.upsert({
    where: { userId: supplierId },
    create: {
      userId: supplierId,
      trustScore: breakdown.score,
      lightningEnabled: parsed.data.lightningEnabled,
    },
    update: {
      trustScore: breakdown.score,
      lightningEnabled: parsed.data.lightningEnabled,
      lightningAdminOverride: false,
    },
    select: { lightningEnabled: true, trustScore: true },
  })

  console.log("[lightning-payout-settings]", {
    supplierId,
    lightningEnabled: profile.lightningEnabled,
    trustScore: profile.trustScore,
  })

  return NextResponse.json({
    success: true,
    trustScore: profile.trustScore,
    lightningEnabled: profile.lightningEnabled,
  })
}
