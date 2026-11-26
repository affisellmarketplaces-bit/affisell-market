import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The temporary Lightning lock must hold whatever the payout implementation behind it (PR #13's A3 hotfix today,
 * PR #12's leg registry after integration): while locked, triggerLightningPayout touches NOTHING — no database,
 * no Stripe. Every collaborator throws on use, so any read, claim or transfer fails this test.
 */
const touched = vi.hoisted(() => ({ list: [] as string[] }))
const trap = vi.hoisted(
  () => (name: string): unknown =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then" || typeof prop === "symbol") return undefined
          touched.list.push(`${name}.${String(prop)}`)
          throw new Error(`touched ${name}.${String(prop)} while Lightning is locked`)
        },
      }
    )
)
vi.mock("@/lib/prisma", () => ({ prisma: trap("prisma") }))
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => {
    touched.list.push("stripe")
    throw new Error("Stripe called while Lightning is locked")
  },
}))

import { triggerLightningPayout } from "@/lib/stripe-lightning"

beforeEach(() => {
  touched.list = []
})

describe("triggerLightningPayout under the lock (implementation-agnostic)", () => {
  for (const value of [undefined, "", "locked", "ENABLED", "Enabled", " enabled", "enabled\n", "true", "1", "on", "yes"]) {
    it(`LIGHTNING_PAYOUTS_MODE=${JSON.stringify(value)} → lightning_locked, nothing touched`, async () => {
      if (value === undefined) delete process.env.LIGHTNING_PAYOUTS_MODE
      else process.env.LIGHTNING_PAYOUTS_MODE = value
      expect(await triggerLightningPayout("order_1")).toEqual({ success: false, reason: "lightning_locked" })
      expect(touched.list).toEqual([])
    })
  }
})
