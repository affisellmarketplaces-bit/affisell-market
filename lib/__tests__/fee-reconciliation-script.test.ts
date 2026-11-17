import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const src = readFileSync("scripts/report-fee-reconciliation.ts", "utf8")
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("report:fee-reconciliation stays a read-only, isolated tool", () => {
  it("every database read runs inside a READ ONLY transaction", () => {
    expect(code).toMatch(/\$transaction\(\s*async \(tx\) => \{\s*await tx\.\$queryRaw`SET TRANSACTION READ ONLY`/)
    expect(code.match(/prisma\.order|prisma\.fulfillmentLog/g)).toBeNull()
  })
  it("Stripe: three GET calls and nothing else", () => {
    const calls = [...code.matchAll(/stripe\.([a-zA-Z.]+)\(/g)].map((m) => m[1]).sort()
    expect(calls).toEqual(["balanceTransactions.list", "issuing.transactions.list", "paymentIntents.retrieve"])
  })
  it("a full live key is refused; the live-key guard still applies", () => {
    expect(code).toMatch(/startsWith\("sk_live_"\)\) throw/)
    expect(code).toMatch(/assertStripeKeyAllowed\(key\)/)
  })
  it("AliExpress: the stored token only, never refreshed (a refresh writes the token store)", () => {
    expect(code).not.toMatch(/getValidAccessToken|forceRefresh|refreshAliExpressAccessToken|resolveAliExpressAccessToken/)
    expect(code).toMatch(/aliexpress\.trade\.ds\.order\.get/)
  })
  it("prints aggregates only, never a raw error", () => {
    expect(code.match(/console\.(log|error|warn)\(/g)).toHaveLength(2)
    expect(code).toMatch(/console\.log\(flag\("json"\) \? JSON\.stringify\(report, null, 2\) : formatReport\(report\)\)/)
    expect(code).toMatch(/console\.error\(`report_failed: \$\{safe\}`\)/)
  })
  it("external reads only on --execute", () => {
    expect(code).toMatch(/const reader = EXECUTE &&/)
    expect(code).toMatch(/if \(EXECUTE && AE\)/)
  })
})
