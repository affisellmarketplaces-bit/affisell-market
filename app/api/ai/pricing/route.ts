import { NextResponse } from "next/server"

type PricingRequest = {
  cost?: number
  compareAt?: number
}

function roundToPrice(value: number): number {
  return Math.round(value * 100) / 100
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PricingRequest
  const cost = Number(body.cost)
  const compareAt = Number(body.compareAt)

  if (!Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json({ error: "Invalid cost" }, { status: 400 })
  }

  const hasCompareAt = Number.isFinite(compareAt) && compareAt > 0
  const candidates = [
    { id: "balanced", label: "Balanced", multiplier: 1.45 },
    { id: "growth", label: "Growth", multiplier: 1.62 },
    { id: "premium", label: "Premium", multiplier: 1.85 },
  ]

  const suggestions = candidates
    .map((candidate) => {
      const price = roundToPrice(cost * candidate.multiplier)
      const marginPct = Math.round(((price - cost) / price) * 100)
      const discountPct =
        hasCompareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0
      return {
        id: candidate.id,
        label: candidate.label,
        price,
        marginPct,
        discountPct,
      }
    })
    .filter((s) => s.discountPct <= 70)

  return NextResponse.json({ suggestions })
}
