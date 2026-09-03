import { NextResponse } from "next/server"
import { z } from "zod"

import { checkAffiliatePayoutRateLimit } from "@/lib/payouts/affiliate-payout-rate-limit"
import {
  isAffiliatePayoutSessionError,
  requireAffiliatePayoutSession,
} from "@/lib/payouts/affiliate-payout-session"
import {
  encryptPayoutDetails,
  getLast4,
  hashFingerprint,
  hasPayoutEncryptionKey,
  normalizePayoutDetailsForFingerprint,
  PayoutEncryptionKeyError,
} from "@/lib/payouts/encryption"
import {
  parseAffiliatePayoutMethodCreateBody,
  payoutDetailsRecord,
} from "@/lib/payouts/validator"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const setDefaultSchema = z.object({
  id: z.string().min(1),
  action: z.literal("setDefault"),
})

export async function GET() {
  const session = await requireAffiliatePayoutSession()
  if (isAffiliatePayoutSessionError(session)) return session

  const { affiliateId } = session
  const methods = await prisma.affiliatePayoutMethod.findMany({
    where: { affiliateId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      country: true,
      isDefault: true,
      status: true,
      last4: true,
      createdAt: true,
    },
  })

  return NextResponse.json(methods)
}

export async function POST(req: Request) {
  const session = await requireAffiliatePayoutSession()
  if (isAffiliatePayoutSessionError(session)) return session

  const { affiliateId } = session

  if (!checkAffiliatePayoutRateLimit(affiliateId)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
  }

  if (!hasPayoutEncryptionKey()) {
    return NextResponse.json({ error: "Payout encryption not configured" }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseAffiliatePayoutMethodCreateBody(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { country, type } = parsed
  const detailsRaw = payoutDetailsRecord(parsed)
  const normalized = normalizePayoutDetailsForFingerprint(type, detailsRaw)
  const fingerprint = hashFingerprint(type, normalized)

  const existing = await prisma.affiliatePayoutMethod.findUnique({
    where: { fingerprint },
  })
  if (existing) {
    return NextResponse.json({ error: "Méthode déjà ajoutée" }, { status: 409 })
  }

  try {
    const encrypted = encryptPayoutDetails(
      Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "type"))
    )
    const last4 = getLast4(type, normalized)
    const count = await prisma.affiliatePayoutMethod.count({ where: { affiliateId } })

    const created = await prisma.affiliatePayoutMethod.create({
      data: {
        affiliateId,
        type,
        country,
        encryptedDetails: encrypted,
        last4,
        fingerprint,
        isDefault: count === 0,
      },
    })

    console.log("[affiliate-payout-methods]", {
      action: "add",
      affiliateId,
      type,
      fingerprint,
      methodId: created.id,
    })

    return NextResponse.json({
      id: created.id,
      type,
      country,
      isDefault: created.isDefault,
      status: created.status,
      last4,
    })
  } catch (error) {
    if (error instanceof PayoutEncryptionKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("[affiliate-payout-methods]", { action: "add", affiliateId, error })
    return NextResponse.json({ error: "Could not save payout method" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await requireAffiliatePayoutSession()
  if (isAffiliatePayoutSessionError(session)) return session

  const { affiliateId } = session

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = setDefaultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { id } = parsed.data
  const owned = await prisma.affiliatePayoutMethod.findFirst({
    where: { id, affiliateId },
    select: { id: true },
  })
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.affiliatePayoutMethod.updateMany({
      where: { affiliateId },
      data: { isDefault: false },
    }),
    prisma.affiliatePayoutMethod.update({
      where: { id, affiliateId },
      data: { isDefault: true },
    }),
  ])

  console.log("[affiliate-payout-methods]", { action: "setDefault", affiliateId, methodId: id })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await requireAffiliatePayoutSession()
  if (isAffiliatePayoutSessionError(session)) return session

  const { affiliateId } = session
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 })
  }

  const toDelete = await prisma.affiliatePayoutMethod.findFirst({
    where: { id, affiliateId },
  })
  if (!toDelete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.affiliatePayoutMethod.delete({ where: { id } })
    if (toDelete.isDefault) {
      const next = await tx.affiliatePayoutMethod.findFirst({
        where: { affiliateId },
        orderBy: { createdAt: "desc" },
      })
      if (next) {
        await tx.affiliatePayoutMethod.update({
          where: { id: next.id },
          data: { isDefault: true },
        })
      }
    }
  })

  console.log("[affiliate-payout-methods]", {
    action: "delete",
    affiliateId,
    methodId: id,
    wasDefault: toDelete.isDefault,
  })

  return NextResponse.json({ ok: true })
}
