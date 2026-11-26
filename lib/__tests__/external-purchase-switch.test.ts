import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  decideExternalPurchaseCheckout,
  EXTERNAL_PURCHASE_DISABLED_ERROR,
  isExternalPurchaseEnabled,
  resolveExternalPurchaseCheckoutMode,
} from "@/lib/procurement/external-purchase-switch"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }))

describe("isExternalPurchaseEnabled — one opt-in switch", () => {
  it("is off by default (owner decision: opt-in)", () => {
    expect(isExternalPurchaseEnabled({})).toBe(false)
    expect(isExternalPurchaseEnabled({ AUTO_BUY_ENABLED: "1" })).toBe(false)
    expect(isExternalPurchaseEnabled({ AUTO_BUY_ENABLED: "TRUE" })).toBe(false)
  })

  it("is on only with the exact word", () => {
    expect(isExternalPurchaseEnabled({ AUTO_BUY_ENABLED: "true" })).toBe(true)
  })

  it("the legacy kill switches win over the opt-in", () => {
    expect(isExternalPurchaseEnabled({ AUTO_BUY_ENABLED: "true", DISABLE_AUTO_BUY: "true" })).toBe(false)
    expect(isExternalPurchaseEnabled({ AUTO_BUY_ENABLED: "true", AUTO_ORDER_ENABLED: "false" })).toBe(false)
  })
})

describe("pre-payment gate for products only an external purchase can deliver", () => {
  const platform = new Set(["platform-supplier"])
  const lines = [
    { productId: "p-catalog", productName: "Own stock", supplierId: "real-supplier" },
    { productId: "p-platform", productName: "Platform item", supplierId: "platform-supplier" },
  ]

  it("mode defaults to warn; off / enforce are explicit", () => {
    expect(resolveExternalPurchaseCheckoutMode({})).toBe("warn")
    expect(resolveExternalPurchaseCheckoutMode({ PROCUREMENT_CHECKOUT_GATE: "enforce" })).toBe("enforce")
    expect(resolveExternalPurchaseCheckoutMode({ PROCUREMENT_CHECKOUT_GATE: " OFF " })).toBe("off")
    expect(resolveExternalPurchaseCheckoutMode({ PROCUREMENT_CHECKOUT_GATE: "nonsense" })).toBe("warn")
  })

  it("warn: reports the blocked line but never refuses", () => {
    const d = decideExternalPurchaseCheckout(lines, platform, {})
    expect(d.blocked?.productId).toBe("p-platform")
    expect(d.refuse).toBe(false)
  })

  it("enforce: refuses the line, purchases off", () => {
    const d = decideExternalPurchaseCheckout(lines, platform, { PROCUREMENT_CHECKOUT_GATE: "enforce" })
    expect(d.refuse).toBe(true)
    expect(d.blocked?.productId).toBe("p-platform")
  })

  it("never blocks a catalogue supplier's own product, whatever the mode", () => {
    const d = decideExternalPurchaseCheckout([lines[0]!], platform, { PROCUREMENT_CHECKOUT_GATE: "enforce" })
    expect(d).toEqual({ mode: "enforce", blocked: null, refuse: false })
  })

  it("nothing is blocked when purchases are enabled, or when the gate is off", () => {
    expect(
      decideExternalPurchaseCheckout(lines, platform, { PROCUREMENT_CHECKOUT_GATE: "enforce", AUTO_BUY_ENABLED: "true" })
        .refuse
    ).toBe(false)
    expect(decideExternalPurchaseCheckout(lines, platform, { PROCUREMENT_CHECKOUT_GATE: "off" }).blocked).toBeNull()
  })

  it("a line without supplier is never blocked", () => {
    const d = decideExternalPurchaseCheckout(
      [{ productId: "x", supplierId: null }],
      platform,
      { PROCUREMENT_CHECKOUT_GATE: "enforce" }
    )
    expect(d.refuse).toBe(false)
  })
})

describe("every external purchase path reads the single switch", () => {
  const root = path.resolve(__dirname, "../..")
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8")

  it.each([
    "lib/fulfillment/auto-buy.ts",
    "lib/auto-order/resolve-channel.ts",
    "lib/aliexpress-fulfill-order.ts",
    "lib/china-buying/trigger-china-buy-for-order.ts",
  ])("%s imports isExternalPurchaseEnabled", (file) => {
    expect(read(file)).toMatch(/import \{[^}]*isExternalPurchaseEnabled[^}]*\} from "@\/lib\/procurement\/external-purchase-switch"/)
  })

  it("auto-buy no longer reads AUTO_BUY_ENABLED itself (one definition only)", () => {
    expect(read("lib/fulfillment/auto-buy.ts")).not.toMatch(/process\.env\.AUTO_BUY_ENABLED/)
  })

  it("every checkout that creates a payment session runs the pre-payment gate", () => {
    for (const file of ["lib/marketplace-checkout.ts", "lib/agent-checkout.ts"]) {
      expect(read(file)).toContain("evaluateExternalPurchaseCheckoutGate(")
    }
    // Two marketplace entry points: cart and single line.
    expect(read("lib/marketplace-checkout.ts").match(/externalPurchaseCheckoutGate\(/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it("a refusal for a disabled switch is never retried by the order.paid workers", async () => {
    const { isNeverRetryFulfillError } = await import("@/lib/aliexpress-fulfill-order")
    expect(isNeverRetryFulfillError(EXTERNAL_PURCHASE_DISABLED_ERROR)).toBe(true)
  })
})
