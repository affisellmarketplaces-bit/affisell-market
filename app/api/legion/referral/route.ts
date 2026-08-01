import { NextResponse } from "next/server"
import { z } from "zod"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { LEGION_OVERRIDE_RATE } from "@/lib/legion/split"
import { normalizeLegionUsername } from "@/lib/legion/username"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  sponsor_username: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .transform(normalizeLegionUsername),
  referred_username: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .transform(normalizeLegionUsername),
})

/**
 * POST /api/legion/referral
 * Idempotent LÉGION link: sponsor → referred (1 niveau, lifetime 2%).
 */
export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "legion-referral",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const { sponsor_username, referred_username } = parsed.data
  if (sponsor_username === referred_username) {
    return NextResponse.json(
      { ok: false, error: "same_username" },
      { status: 400 }
    )
  }

  const [sponsor, referred] = await Promise.all([
    prisma.storeProfile.findFirst({
      where: { username: sponsor_username, isActive: true },
      select: { id: true, username: true },
    }),
    prisma.storeProfile.findFirst({
      where: { username: referred_username, isActive: true },
      select: { id: true, username: true },
    }),
  ])

  if (!sponsor || !referred) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  }

  const existing = await prisma.legionReferral.findUnique({
    where: { referredId: referred.id },
    select: { id: true, sponsorId: true },
  })
  if (existing) {
    console.log("[legion]", {
      result: "referral_already",
      referred: referred.username,
      sponsorId: existing.sponsorId,
    })
    return NextResponse.json({
      ok: true,
      already: true,
      referral_id: existing.id,
    })
  }

  const created = await prisma.legionReferral.create({
    data: {
      sponsorId: sponsor.id,
      referredId: referred.id,
      status: "active",
      overrideRate: LEGION_OVERRIDE_RATE,
    },
    select: { id: true },
  })

  console.log("[legion]", {
    result: "referral_created",
    sponsor: sponsor.username,
    referred: referred.username,
    referralId: created.id,
  })

  return NextResponse.json({
    ok: true,
    already: false,
    referral_id: created.id,
  })
}
