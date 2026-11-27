import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  checkEndpointSubscription,
  STRIPE_WEBHOOK_MONEY_CRITICAL_EVENTS,
  STRIPE_WEBHOOK_REQUIRED_EVENTS,
} from "@/lib/stripe-webhook-required-events"

const processor = fs.readFileSync(path.join(process.cwd(), "lib/stripe-webhook-processor.ts"), "utf8")
const handled = [...new Set([...processor.matchAll(/^\s*case "([a-z_.]+)":/gm)].map((m) => m[1]))].sort()

describe("required Stripe webhook events = what the processor handles", () => {
  it("lists exactly the processor's case labels (adding a handler without the subscription fails here)", () => {
    expect(handled.length).toBeGreaterThan(5)
    expect([...STRIPE_WEBHOOK_REQUIRED_EVENTS].sort()).toEqual(handled)
  })

  it("includes all five dispute events of the D7 ledger (STRIPE_DISPUTE_EVENT_TYPES)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/stripe-dispute.ts"), "utf8")
    const block = src.slice(
      src.indexOf("STRIPE_DISPUTE_EVENT_TYPES = ["),
      src.indexOf("] as const", src.indexOf("STRIPE_DISPUTE_EVENT_TYPES = [")),
    )
    const disputes = [...block.matchAll(/"([a-z_.]+)"/g)].map((m) => m[1])
    expect(disputes).toHaveLength(5)
    for (const e of disputes) expect(STRIPE_WEBHOOK_REQUIRED_EVENTS).toContain(e)
  })
})

describe("checkEndpointSubscription", () => {
  it("a wildcard endpoint misses nothing", () => {
    expect(checkEndpointSubscription({ url: "https://x/api/webhooks/stripe", enabled_events: ["*"] }).missing).toEqual(
      [],
    )
  })

  it("an endpoint without dispute events is flagged money-critical", () => {
    const r = checkEndpointSubscription({
      url: "https://x/api/webhooks/stripe",
      status: "enabled",
      enabled_events: ["checkout.session.completed", "payment_intent.succeeded", "charge.refunded"],
    })
    expect(r.missingMoneyCritical).toEqual(
      STRIPE_WEBHOOK_MONEY_CRITICAL_EVENTS.filter((e) => e.startsWith("charge.dispute.")),
    )
    expect(r.enabled).toBe(true)
  })

  it("a disabled endpoint is reported as such", () => {
    expect(checkEndpointSubscription({ url: "u", status: "disabled", enabled_events: ["*"] }).enabled).toBe(false)
  })
})
