import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { normalizeLegionUsername } from "@/lib/legion/username"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/legion/stats?username=xxx
 * Public LÉGION stats for a storefront profile.
 */
export async function GET(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "legion-stats",
    limit: 60,
    windowMs: 60 * 1000,
  })
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const raw = searchParams.get("username") ?? ""
  const username = normalizeLegionUsername(raw)
  if (username.length < 3 || username.length > 20) {
    return NextResponse.json({ ok: false, error: "invalid_username" }, { status: 400 })
  }

  const profile = await prisma.storeProfile.findFirst({
    where: { username, isActive: true },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      totalSales: true,
      totalEarnings: true,
      createdAt: true,
    },
  })
  if (!profile) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  }

  const filleuls = await prisma.legionReferral.findMany({
    where: { sponsorId: profile.id, status: "active" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      overrideRate: true,
      totalOverrideEarned: true,
      createdAt: true,
      referred: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          totalSales: true,
        },
      },
    },
  })

  const totalOverride = filleuls.reduce(
    (sum, row) => sum + Number(row.totalOverrideEarned),
    0
  )

  return NextResponse.json({
    ok: true,
    profile: {
      username: profile.username,
      display_name: profile.displayName,
      bio: profile.bio,
      avatar_url: profile.avatarUrl,
      total_sales: profile.totalSales,
      total_earnings: Number(profile.totalEarnings),
      created_at: profile.createdAt.toISOString(),
    },
    filleuls_count: filleuls.length,
    total_override: Math.round(totalOverride * 100) / 100,
    filleuls: filleuls.map((row) => ({
      username: row.referred.username,
      display_name: row.referred.displayName,
      avatar_url: row.referred.avatarUrl,
      total_sales: row.referred.totalSales,
      override_rate: Number(row.overrideRate),
      override_earned: Number(row.totalOverrideEarned),
      since: row.createdAt.toISOString(),
    })),
  })
}
