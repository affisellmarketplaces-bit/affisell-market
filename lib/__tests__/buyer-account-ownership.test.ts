import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ userFindUnique: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFindUnique } } }))

import {
  buyerAccountNeedsSignIn,
  buyerAccountRequiresSignIn,
  loadBuyerAccountOwnershipSignals,
  type BuyerAccountOwnershipSignals,
} from "@/lib/buyer-account-ownership.server"

const BLANK: BuyerAccountOwnershipSignals = {
  hasPassword: false,
  hasOAuthAccount: false,
  emailVerified: false,
  hasOrders: false,
  hasRewards: false,
  hasReviews: false,
}

function userRow(over: {
  password?: string | null
  emailVerified?: Date | null
  buyerRewardBalanceCents?: number
  accounts?: number
  buyerRewardLedger?: number
  buyerReviews?: number
  buyerMarketplaceOrders?: number
} = {}) {
  return {
    password: over.password ?? null,
    emailVerified: over.emailVerified ?? null,
    buyerRewardBalanceCents: over.buyerRewardBalanceCents ?? 0,
    _count: {
      accounts: over.accounts ?? 0,
      buyerRewardLedger: over.buyerRewardLedger ?? 0,
      buyerReviews: over.buyerReviews ?? 0,
      buyerMarketplaceOrders: over.buyerMarketplaceOrders ?? 0,
    },
  }
}

describe("buyerAccountNeedsSignIn", () => {
  it("lets a blank account through", () => {
    expect(buyerAccountNeedsSignIn(BLANK)).toBe(false)
  })

  for (const key of Object.keys(BLANK) as (keyof BuyerAccountOwnershipSignals)[]) {
    it(`requires sign-in as soon as ${key} is true`, () => {
      expect(buyerAccountNeedsSignIn({ ...BLANK, [key]: true })).toBe(true)
    })
  }
})

describe("loadBuyerAccountOwnershipSignals", () => {
  beforeEach(() => {
    m.userFindUnique.mockReset()
  })

  it("reads a blank guest account as blank", async () => {
    m.userFindUnique.mockResolvedValue(userRow())
    await expect(loadBuyerAccountOwnershipSignals("u1")).resolves.toEqual(BLANK)
  })

  it("maps every kind of owner sign and history", async () => {
    m.userFindUnique.mockResolvedValue(
      userRow({
        password: "$2b$hash",
        emailVerified: new Date("2026-01-01"),
        accounts: 1,
        buyerMarketplaceOrders: 2,
        buyerRewardLedger: 1,
        buyerReviews: 3,
      })
    )
    await expect(loadBuyerAccountOwnershipSignals("u1")).resolves.toEqual({
      hasPassword: true,
      hasOAuthAccount: true,
      emailVerified: true,
      hasOrders: true,
      hasRewards: true,
      hasReviews: true,
    })
  })

  it("counts a positive reward balance even without a ledger row", async () => {
    m.userFindUnique.mockResolvedValue(userRow({ buyerRewardBalanceCents: 250 }))
    await expect(loadBuyerAccountOwnershipSignals("u1")).resolves.toMatchObject({ hasRewards: true })
  })

  it("counts every order when no Stripe session is ignored", async () => {
    m.userFindUnique.mockResolvedValue(userRow())
    await loadBuyerAccountOwnershipSignals("u1")
    const query = m.userFindUnique.mock.calls[0]![0]
    expect(query.where).toEqual({ id: "u1" })
    expect(query.select._count.select.buyerMarketplaceOrders).toBe(true)
  })

  it("does not count the orders of the Stripe session being claimed", async () => {
    m.userFindUnique.mockResolvedValue(userRow())
    await loadBuyerAccountOwnershipSignals("u1", { ignoreStripeSessionId: " cs_current " })
    const query = m.userFindUnique.mock.calls[0]![0]
    expect(query.select._count.select.buyerMarketplaceOrders).toEqual({
      where: { stripeSessionId: { not: "cs_current" } },
    })
  })

  it("returns null for a missing user", async () => {
    m.userFindUnique.mockResolvedValue(null)
    await expect(loadBuyerAccountOwnershipSignals("ghost")).resolves.toBeNull()
  })
})

describe("buyerAccountRequiresSignIn", () => {
  beforeEach(() => {
    m.userFindUnique.mockReset()
  })

  it("is false for a blank account", async () => {
    m.userFindUnique.mockResolvedValue(userRow())
    await expect(buyerAccountRequiresSignIn("u1")).resolves.toBe(false)
  })

  it("is true for an account with a password", async () => {
    m.userFindUnique.mockResolvedValue(userRow({ password: "$2b$hash" }))
    await expect(buyerAccountRequiresSignIn("u1")).resolves.toBe(true)
  })

  it("fails closed when the account cannot be read", async () => {
    m.userFindUnique.mockResolvedValue(null)
    await expect(buyerAccountRequiresSignIn("ghost")).resolves.toBe(true)
  })

  it("propagates a database error instead of answering 'allowed'", async () => {
    m.userFindUnique.mockRejectedValue(new Error("db down"))
    await expect(buyerAccountRequiresSignIn("u1")).rejects.toThrow("db down")
  })
})
