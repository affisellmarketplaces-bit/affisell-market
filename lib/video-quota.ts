import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { FREE_VIDEO_LIMIT } from "@/lib/video-quota-constants"

export { FREE_VIDEO_LIMIT } from "@/lib/video-quota-constants"

export type VideoQuotaSnapshot = {
  videoCount: number
  videoLimit: number
  isPro: boolean
  remaining: number
}

export function quotaSnapshot(user: { videoCount: number; isPro: boolean }): VideoQuotaSnapshot {
  const videoLimit = user.isPro ? Number.MAX_SAFE_INTEGER : FREE_VIDEO_LIMIT
  return {
    videoCount: user.videoCount,
    videoLimit,
    isPro: user.isPro,
    remaining: user.isPro ? Number.MAX_SAFE_INTEGER : Math.max(0, FREE_VIDEO_LIMIT - user.videoCount),
  }
}

export function isQuotaExceeded(user: { videoCount: number; isPro: boolean }): boolean {
  return !user.isPro && user.videoCount >= FREE_VIDEO_LIMIT
}

export function paywallResponse() {
  return NextResponse.json(
    {
      error: "Quota atteint",
      paywall: true,
      priceId: process.env.STRIPE_PRO_PRICE_ID?.trim() ?? null,
    },
    { status: 402 }
  )
}

export async function fetchUserVideoQuota(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, videoCount: true, isPro: true },
  })
  if (!user) return null
  return { user, snapshot: quotaSnapshot(user) }
}

/** Increment only if free user is still under the limit (avoids race past 3 videos). */
export async function incrementVideoCountIfAllowed(
  userId: string
): Promise<VideoQuotaSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { videoCount: true, isPro: true },
  })
  if (!user) return null

  if (user.isPro) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { videoCount: { increment: 1 } },
      select: { videoCount: true, isPro: true },
    })
    return quotaSnapshot(updated)
  }

  const result = await prisma.user.updateMany({
    where: { id: userId, isPro: false, videoCount: { lt: FREE_VIDEO_LIMIT } },
    data: { videoCount: { increment: 1 } },
  })
  if (result.count === 0) return null

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { videoCount: true, isPro: true },
  })
  return updated ? quotaSnapshot(updated) : null
}

/** @deprecated Use {@link incrementVideoCountIfAllowed} */
export async function incrementVideoCount(userId: string): Promise<VideoQuotaSnapshot> {
  const snap = await incrementVideoCountIfAllowed(userId)
  if (snap) return snap
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { videoCount: true, isPro: true },
  })
  return quotaSnapshot(user ?? { videoCount: FREE_VIDEO_LIMIT, isPro: false })
}
