import { prisma } from "@/lib/prisma"

/**
 * An e-mail or phone number typed in a form — or on Stripe's payment page — proves nothing: anyone can type
 * someone else's. So a bare identifier must never open a session on a buyer account that already shows a sign
 * of an owner (password, social login, verified e-mail) or holds history (orders, rewards, reviews): that
 * account's orders, addresses and data export would be handed to whoever knew the address.
 *
 * A blank account — created by the very flow that is asking — keeps the one-step guest checkout.
 */
export type BuyerAccountOwnershipSignals = {
  hasPassword: boolean
  hasOAuthAccount: boolean
  emailVerified: boolean
  hasOrders: boolean
  hasRewards: boolean
  hasReviews: boolean
}

/** Pure decision: any sign of an owner or of history means the buyer must sign in. */
export function buyerAccountNeedsSignIn(signals: BuyerAccountOwnershipSignals): boolean {
  return (
    signals.hasPassword ||
    signals.hasOAuthAccount ||
    signals.emailVerified ||
    signals.hasOrders ||
    signals.hasRewards ||
    signals.hasReviews
  )
}

export type BuyerAccountOwnershipOptions = {
  /**
   * Orders paid through this Stripe Checkout session are not history: a guest who just paid must still be able
   * to open the account that payment created. Orders from any other session count.
   */
  ignoreStripeSessionId?: string
}

export async function loadBuyerAccountOwnershipSignals(
  userId: string,
  options: BuyerAccountOwnershipOptions = {}
): Promise<BuyerAccountOwnershipSignals | null> {
  const ignore = options.ignoreStripeSessionId?.trim()
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      emailVerified: true,
      buyerRewardBalanceCents: true,
      _count: {
        select: {
          accounts: true,
          buyerRewardLedger: true,
          buyerReviews: true,
          buyerMarketplaceOrders: ignore ? { where: { stripeSessionId: { not: ignore } } } : true,
        },
      },
    },
  })
  if (!row) return null

  return {
    hasPassword: Boolean(row.password),
    hasOAuthAccount: row._count.accounts > 0,
    emailVerified: row.emailVerified != null,
    hasOrders: row._count.buyerMarketplaceOrders > 0,
    hasRewards: row.buyerRewardBalanceCents > 0 || row._count.buyerRewardLedger > 0,
    hasReviews: row._count.buyerReviews > 0,
  }
}

/**
 * True when a bare identifier must NOT open a session on this account. Fails closed: an account that cannot be
 * read is treated as protected, and a database error propagates so the caller answers with its generic failure
 * instead of a session.
 */
export async function buyerAccountRequiresSignIn(
  userId: string,
  options: BuyerAccountOwnershipOptions = {}
): Promise<boolean> {
  const signals = await loadBuyerAccountOwnershipSignals(userId, options)
  if (!signals) return true
  return buyerAccountNeedsSignIn(signals)
}
