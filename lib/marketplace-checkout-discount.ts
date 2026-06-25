export { STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS } from "@/lib/stripe-minimum"

/**
 * Split `targetPaidTotal` across lines proportionally (integer cents), never paying more than original `subs` per line.
 * Caller must ensure `targetPaidTotal <= sum(subs)` and `targetPaidTotal >= 0`.
 */
export function proportionalLinePaidsCents(subs: number[], targetPaidTotal: number): number[] {
  if (subs.length === 0) return []
  const sub = subs.reduce((a, b) => a + b, 0)
  if (sub <= 0) return subs.map(() => 0)
  const target = Math.max(0, Math.min(targetPaidTotal, sub))
  const paid = subs.map((s) => Math.floor((s * target) / sub))
  let debt = target - paid.reduce((a, b) => a + b, 0)
  let guard = 0
  while (debt > 0 && guard++ < 100_000) {
    let progressed = false
    for (let i = 0; i < paid.length && debt > 0; i++) {
      if (paid[i] < subs[i]) {
        paid[i]++
        debt--
        progressed = true
      }
    }
    if (!progressed) break
  }
  return paid
}

/**
 * After proportional split, no row with a positive list price should stay at 0 paid while the order still
 * has positive total (avoids Stripe `unit_amount: 0` when splitting per unit).
 * Preserves sum(paid) == sum(original paid input).
 */
export function fixZeroPaidLinesCents(lineSubs: number[], paid: number[]): number[] {
  const out = [...paid]
  let guard = 0
  while (guard++ < 10_000) {
    const zeroIdx = out.findIndex((p, i) => p <= 0 && lineSubs[i] > 0)
    if (zeroIdx === -1) break
    let donor = -1
    let donorVal = 0
    for (let i = 0; i < out.length; i++) {
      if (out[i] > donorVal) {
        donorVal = out[i]
        donor = i
      }
    }
    if (donor === -1 || out[donor]! <= 1) break
    out[donor]!--
    out[zeroIdx]!++
  }
  return out
}
