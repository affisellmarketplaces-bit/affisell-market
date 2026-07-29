/**
 * Reseller product selection for Pulse Battle (client-safe pure helpers).
 */

export type BattleContenderSide = "A" | "B"

export type ResolveBattleContenderInput = {
  productAId: string
  productBId: string
  preferredProductId: string
  ownsA: boolean
  ownsB: boolean
}

export type ResolveBattleContenderResult = {
  productAId: string
  productBId: string
  side: BattleContenderSide
  /** True when preferred was already A or B. */
  unchanged: boolean
  /** Caller must pick a new opponent for productB. */
  needsOpponent: boolean
}

/**
 * Place the reseller's product on their owned side, else as product A.
 * Never duplicates A/B; flags needsOpponent when B would collide.
 */
export function resolveBattleContenderPlacement(
  input: ResolveBattleContenderInput
): ResolveBattleContenderResult {
  const preferred = input.preferredProductId.trim()
  const a = input.productAId.trim()
  const b = input.productBId.trim()

  if (!preferred) {
    return {
      productAId: a,
      productBId: b,
      side: "A",
      unchanged: true,
      needsOpponent: false,
    }
  }

  if (preferred === a) {
    return {
      productAId: a,
      productBId: b,
      side: "A",
      unchanged: true,
      needsOpponent: false,
    }
  }
  if (preferred === b) {
    return {
      productAId: a,
      productBId: b,
      side: "B",
      unchanged: true,
      needsOpponent: false,
    }
  }

  if (input.ownsA) {
    return {
      productAId: preferred,
      productBId: b === preferred ? a : b,
      side: "A",
      unchanged: false,
      needsOpponent: b === preferred,
    }
  }
  if (input.ownsB) {
    return {
      productAId: a === preferred ? b : a,
      productBId: preferred,
      side: "B",
      unchanged: false,
      needsOpponent: a === preferred,
    }
  }

  return {
    productAId: preferred,
    productBId: b === preferred ? a : b,
    side: "A",
    unchanged: false,
    needsOpponent: b === preferred,
  }
}
