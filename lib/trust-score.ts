import { isAfterShipTrackingValid } from "@/lib/aftership-tracking"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

const DISPUTE_RATE_MAX = 0.05
const MIN_ORDERS_FOR_VOLUME_BONUS = 10
const TRACKING_SAMPLE_SIZE = 10

export type TrustScoreBreakdown = {
  score: number
  stripePoints: number
  volumePoints: number
  trackingPoints: number
  chargesEnabled: boolean
  paidOrderCount: number
  disputeRate: number
  trackingSampleSize: number
  trackingValidCount: number
}

function clampTrustScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function resolveStripeAccountId(supplierId: string): Promise<string | null> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: supplierId },
      select: { stripeAccountId: true },
    }),
    prisma.supplierProfile.findUnique({
      where: { userId: supplierId },
      select: { stripeAccountId: true },
    }),
  ])
  return profile?.stripeAccountId?.trim() || user?.stripeAccountId?.trim() || null
}

async function isStripeChargesEnabled(stripeAccountId: string | null): Promise<boolean> {
  if (!stripeAccountId) return false
  try {
    const stripe = getStripeClient()
    const account = await stripe.accounts.retrieve(stripeAccountId)
    return account.charges_enabled === true
  } catch (error) {
    console.log("[trust-score]", {
      stripeAccountId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

async function computeSupplierDisputeRate(supplierId: string): Promise<{
  paidOrderCount: number
  disputeRate: number
}> {
  const [paidOrderCount, disputedOrders] = await Promise.all([
    prisma.order.count({
      where: { supplierId, paidAt: { not: null } },
    }),
    prisma.orderReturn.findMany({
      where: {
        status: { not: "REJECTED" },
        order: { supplierId, paidAt: { not: null } },
      },
      select: { orderId: true },
      distinct: ["orderId"],
    }),
  ])

  const disputeRate =
    paidOrderCount > 0 ? disputedOrders.length / paidOrderCount : 1

  return { paidOrderCount, disputeRate }
}

async function areRecentTrackingsValid(supplierId: string): Promise<{
  sampleSize: number
  validCount: number
  allValid: boolean
}> {
  const recent = await prisma.order.findMany({
    where: {
      supplierId,
      shippedAt: { not: null },
      trackingNumber: { not: null },
    },
    orderBy: { shippedAt: "desc" },
    take: TRACKING_SAMPLE_SIZE,
    select: { trackingNumber: true, trackingCarrier: true },
  })

  if (recent.length < TRACKING_SAMPLE_SIZE) {
    return { sampleSize: recent.length, validCount: 0, allValid: false }
  }

  const results = await Promise.all(
    recent.map((row) =>
      isAfterShipTrackingValid(row.trackingNumber ?? "", row.trackingCarrier)
    )
  )
  const validCount = results.filter(Boolean).length

  return {
    sampleSize: recent.length,
    validCount,
    allValid: validCount === recent.length,
  }
}

/**
 * Lightning trust score (0–100). Intended for daily cron refresh on `SupplierProfile.trustScore`.
 */
export async function calculateTrustScore(supplierId: string): Promise<number> {
  const breakdown = await calculateTrustScoreBreakdown(supplierId)
  return breakdown.score
}

export async function calculateTrustScoreBreakdown(
  supplierId: string
): Promise<TrustScoreBreakdown> {
  const stripeAccountId = await resolveStripeAccountId(supplierId)
  const [chargesEnabled, volume, tracking] = await Promise.all([
    isStripeChargesEnabled(stripeAccountId),
    computeSupplierDisputeRate(supplierId),
    areRecentTrackingsValid(supplierId),
  ])

  const stripePoints = chargesEnabled ? 20 : 0
  const volumePoints =
    volume.paidOrderCount > MIN_ORDERS_FOR_VOLUME_BONUS &&
    volume.disputeRate < DISPUTE_RATE_MAX
      ? 30
      : 0
  const trackingPoints = tracking.allValid ? 50 : 0
  const score = clampTrustScore(stripePoints + volumePoints + trackingPoints)

  console.log("[trust-score]", {
    supplierId,
    score,
    stripePoints,
    volumePoints,
    trackingPoints,
    paidOrderCount: volume.paidOrderCount,
    disputeRate: volume.disputeRate,
    trackingSampleSize: tracking.sampleSize,
    trackingValidCount: tracking.validCount,
  })

  return {
    score,
    stripePoints,
    volumePoints,
    trackingPoints,
    chargesEnabled,
    paidOrderCount: volume.paidOrderCount,
    disputeRate: volume.disputeRate,
    trackingSampleSize: tracking.sampleSize,
    trackingValidCount: tracking.validCount,
  }
}
