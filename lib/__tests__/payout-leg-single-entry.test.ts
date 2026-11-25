import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Scenario 14 — no path can create a Stripe transfer without the payout leg registry.
 * Every source file is scanned; the ONLY file allowed to call `transfers.create` (or to POST /v1/transfers by hand) is
 * lib/payouts/leg-transfer.server.ts. A new rail must call `executeLegTransfer`, never Stripe.
 */
const ROOT = join(__dirname, "..", "..")
const SCANNED = ["lib", "app", "inngest", "workers", "scripts", "components", "hooks"]
const ALLOWED = new Set(["lib/payouts/leg-transfer.server.ts"])
const EXT = /\.(ts|tsx|js|mjs|cjs)$/

function walk(dir: string, out: string[]) {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (EXT.test(name)) out.push(p)
  }
}

const files: string[] = []
for (const d of SCANNED) walk(join(ROOT, d), files)

const CREATE_PATTERNS: RegExp[] = [
  /\btransfers\s*\.\s*create\s*\(/, // stripe.transfers.create( / getStripeClient().transfers.create(
  /\btransfers\s*\[\s*["'`]create["'`]\s*\]/, // transfers["create"]
  /["'`]\/v1\/transfers["'`][^\n]*(POST|method)/i, // a hand-made POST to the transfers endpoint
  /method\s*:\s*["'`]POST["'`][^\n]*\/v1\/transfers\b/i,
]

describe("payout leg registry — single entry point", () => {
  it("scans a real code base", () => {
    expect(files.length).toBeGreaterThan(500)
  })

  it("only lib/payouts/leg-transfer.server.ts creates Stripe transfers", () => {
    const offenders: string[] = []
    for (const f of files) {
      const rel = relative(ROOT, f).split("\\").join("/")
      if (ALLOWED.has(rel)) continue
      const src = readFileSync(f, "utf8")
      if (CREATE_PATTERNS.some((re) => re.test(src))) offenders.push(rel)
    }
    expect(offenders).toEqual([])
  })

  it("the allowed file really is the creator", () => {
    const src = readFileSync(join(ROOT, "lib/payouts/leg-transfer.server.ts"), "utf8")
    expect(src).toMatch(/stripe\.transfers\.create\(request, \{ idempotencyKey \}\)/)
  })

  it("every rail that pays goes through executeLegTransfer", () => {
    const rails = [
      "lib/transfers/process-transfers.ts",
      "lib/stripe-lightning.ts",
      "lib/legion/pay-referral-override.ts",
      "lib/blind-dropship-fulfill.ts",
      "lib/auto-order/payment/index.ts",
      "lib/agents/withdraw-agent-balance.ts",
    ]
    for (const rel of rails) {
      const src = readFileSync(join(ROOT, rel), "utf8")
      expect(src, rel).toMatch(/executeLegTransfer\(/)
    }
  })

  it("the dormant creators are gone", () => {
    const connect = readFileSync(join(ROOT, "lib/stripe-connect-transfer.ts"), "utf8")
    expect(connect).not.toMatch(/export async function createConnectTransfer/)
    expect(() => statSync(join(ROOT, "lib/legion/stripe-patch.ts"))).toThrow()
  })
})
