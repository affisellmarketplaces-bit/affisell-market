import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const script = strip(readFileSync("scripts/report-fee-reconciliation.ts", "utf8"))
const run = strip(readFileSync("lib/strategic-intelligence/fee-reconciliation-run.ts", "utf8"))

/** Every repository module the script loads, transitively (value and type imports alike — stricter than needed). */
function importGraph(entry: string): Set<string> {
  const seen = new Set<string>()
  const stack = [path.join(ROOT, entry)]
  while (stack.length) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const src = readFileSync(file, "utf8")
    for (const m of src.matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
      const spec = m[1] ?? m[2]!
      let target: string | null = null
      if (spec.startsWith("@/")) target = path.join(ROOT, spec.slice(2))
      else if (spec.startsWith(".")) target = path.resolve(path.dirname(file), spec)
      if (!target) continue
      const hit = [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")].find((f) => existsSync(f) && !f.endsWith("/"))
      if (hit && hit.endsWith(".ts")) stack.push(hit)
    }
  }
  return new Set([...seen].map((f) => path.relative(ROOT, f)))
}

const REFRESH_IN_OTHER_FUNCTIONS = new Set(["lib/aliexpress-ds-sync.ts", "lib/aliexpress-open-api.ts"])

describe("report:fee-reconciliation is a read-only, isolated tool", () => {
  const graph = importGraph("scripts/report-fee-reconciliation.ts")

  it("loads no application database client, no server-only module, no token refresh code", () => {
    expect(graph.has("lib/strategic-intelligence/fee-reconciliation-run.ts")).toBe(true)
    for (const f of graph) {
      expect(f, f).not.toMatch(/^lib\/prisma(-radar)?\.ts$|aliexpress-oauth|aliexpress-token-store|build-write-guard/)
      const src = readFileSync(f, "utf8")
      expect(src, f).not.toMatch(/^import\s+["']server-only["']/m)
      // Two AliExpress modules hold refresh code in OTHER functions, behind a dynamic import (pinned below).
      if (!REFRESH_IN_OTHER_FUNCTIONS.has(f)) expect(src, f).not.toMatch(/refreshRotateAndPersist|saveAliExpressTokens|getValidAccessToken\(/)
    }
  })

  it("the one AliExpress function the script calls can not refresh a token, import, or reach the database", () => {
    const src = readFileSync("lib/aliexpress-ds-sync.ts", "utf8")
    const start = src.indexOf("export async function callAliExpressSyncMethod(")
    const body = src.slice(start, src.indexOf("\n}\n", start) + 2)
    expect(body.length).toBeGreaterThan(500)
    expect(body).not.toMatch(/import\(|getValidAccessToken|aliexpress-oauth|prisma|saveAliExpress/)
    // its only awaits are the HTTP call and reading its body
    expect([...body.matchAll(/await ([a-zA-Z.]+)\(/g)].map((m) => m[1]).sort()).toEqual(["fetch", "fetch", "res.text"])
    expect([...script.matchAll(/(callAliExpressSyncMethod|getAliExpressDsProduct|createAliExpressClient)\(/g)].map((m) => m[1])).toEqual(["callAliExpressSyncMethod"])
  })

  it("the only Prisma client is created by the script and wrapped read-only before use", () => {
    expect(script.match(/new PrismaClient\(/g)).toHaveLength(1)
    expect(script).toMatch(/const db = readOnlyPrismaClient\(base\)/)
    expect(script).toMatch(/readReconciliationFacts\(db, args\)/)
    expect(script.match(/\bbase\.(?!\$disconnect)/g)).toBeNull()
  })

  it("every database read runs in a transaction whose FIRST statement makes it read-only", () => {
    expect(run).toMatch(/client\.\$transaction\(\s*async \(tx: Prisma\.TransactionClient\) => \{\s*await tx\.\$queryRaw`SET TRANSACTION READ ONLY`\s*return work\(tx\)/)
    expect(run).toMatch(/return withReadOnlyTransaction\(client, async \(tx\) =>/)
    expect(run.match(/client\.\$transaction|tx\.\$transaction/g)).toHaveLength(1)
  })

  it("Stripe: three GET calls and nothing else; the key is picked and guarded inside the reader only", () => {
    const calls = [...script.matchAll(/stripe\.([a-zA-Z.]+)\(/g)].map((m) => m[1]).sort()
    expect(calls).toEqual(["balanceTransactions.list", "issuing.transactions.list", "paymentIntents.retrieve"])
    expect(script).toMatch(/function stripeReader\(\): StripeReader \{\s*const key = pickReconciliationKey\(process\.env\)\s*assertStripeKeyAllowed\(key\)/)
  })

  it("AliExpress: the stored token only, never refreshed, never written; one read method", () => {
    expect(script).not.toMatch(/getValidAccessToken|forceRefresh|refreshAliExpress|resolveAliExpressAccessToken|saveAliExpress/)
    expect([...script.matchAll(/method: "([a-z.]+)"/g)].map((m) => m[1])).toEqual(["aliexpress.trade.ds.order.get"])
  })

  it("prints aggregates only, never a raw error", () => {
    expect(script.match(/console\.(log|error|warn|info|debug)\(/g)).toHaveLength(2)
    expect(script).toMatch(/console\.log\(flag\("json"\) \? JSON\.stringify\(report, null, 2\) : formatReport\(report\)\)/)
    expect(script).toMatch(/console\.error\(`report_failed: \$\{safe\}`\)/)
  })
})
