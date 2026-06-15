import { NextResponse } from "next/server"
import { z } from "zod"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { isStripeCheckoutCountryResolved } from "@/lib/checkout-country-rollout"
import { joinLaunchWaitlistPayload, validateJoinLaunchWaitlist } from "@/lib/checkout-launch-waitlist"
import { logBusiness } from "@/lib/business-log"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  email: z.string().trim().max(254),
  country: z.string().trim().max(8).optional(),
  locale: z.string().trim().max(8).optional(),
  website: z.string().max(0).optional(),
})

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "launch-waitlist",
    limit: 8,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const { email, country, locale, website } = parsed.data
  if (website && website.length > 0) {
    logBusiness("launch-waitlist", { result: "blocked", reason: "honeypot" })
    return NextResponse.json({ ok: true, created: false })
  }

  const countryIso2 = country?.trim() || resolveVisitorCountryIso2(req.headers)
  if (!countryIso2) {
    return NextResponse.json({ ok: false, error: "country_required" }, { status: 400 })
  }

  if (await isStripeCheckoutCountryResolved(countryIso2)) {
    logBusiness("launch-waitlist", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: "already_available",
    })
    return NextResponse.json({ ok: false, error: "already_available" }, { status: 400 })
  }

  const validation = validateJoinLaunchWaitlist({
    email,
    countryIso2,
    marketRegion: MARKET_REGION,
    locale,
  })
  if (validation) {
    logBusiness("launch-waitlist", {
      country: countryIso2,
      marketRegion: MARKET_REGION,
      result: validation.error,
    })
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
  }

  const payload = joinLaunchWaitlistPayload({
    email,
    countryIso2,
    marketRegion: MARKET_REGION,
    locale,
  })
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  try {
    const existing = await prisma.checkoutLaunchWaitlist.findUnique({
      where: {
        email_countryIso2_marketRegion: {
          email: payload.email,
          countryIso2: payload.countryIso2,
          marketRegion: payload.marketRegion,
        },
      },
      select: { id: true },
    })

    await prisma.checkoutLaunchWaitlist.upsert({
      where: {
        email_countryIso2_marketRegion: {
          email: payload.email,
          countryIso2: payload.countryIso2,
          marketRegion: payload.marketRegion,
        },
      },
      create: payload,
      update: { locale: payload.locale, updatedAt: new Date() },
    })

    const created = !existing
    logBusiness("launch-waitlist", {
      country: payload.countryIso2,
      marketRegion: payload.marketRegion,
      result: created ? "joined" : "updated",
    })

    return NextResponse.json({ ok: true, created })
  } catch (error) {
    console.error("[launch-waitlist]", {
      country: payload.countryIso2,
      marketRegion: payload.marketRegion,
      result: "db_error",
      error,
    })
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 })
  }
}
