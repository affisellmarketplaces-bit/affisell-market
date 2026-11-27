import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * No path can buy from a supplier without the central lock. Every source file that contains the network marker of a
 * supplier purchase (or of the money that pays one) must go through the policy (`supplierPurchaseDecision`) or the
 * guard (`guardSupplierPurchase`). A new purchase path that forgets fails here.
 */
const ROOT = process.cwd()
const DIRS = ["lib", "app", "workers", "inngest", "scripts"]
const MARKERS: Array<[RegExp, string]> = [
  [/aliexpress\.ds\.order\.create|aliexpress\.trade\.buy\.placeorder/, "AliExpress DS place-order"],
  [/createOrderV2|\/shopping\/pay\/payment/, "CJ create / pay order"],
  [/createOrderPath\s*\?\?\s*["']\/orders["']/, "partner REST create order"],
  [/purchase\/route|items\/route/, "China buying agent purchase"],
  [/issuing\.cards\.create/, "Stripe Issuing card (pays a supplier)"],
  [/walletBalanceCents:\s*\{\s*decrement/, "supplier wallet debit"],
]
const GATED = /guardSupplierPurchase|supplierPurchaseDecision/
/** Code only: a marker inside a comment is not a purchase. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === "node_modules" || e === "__tests__" || e.startsWith(".")) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(e) && !/\.test\./.test(e)) out.push(p)
  }
  return out
}

describe("supplier purchase inventory", () => {
  const files = DIRS.flatMap((d) => walk(join(ROOT, d)))
  const hits = files.flatMap((f) => {
    const src = code(readFileSync(f, "utf8"))
    return MARKERS.filter(([re]) => re.test(src)).map(([, what]) => ({
      file: relative(ROOT, f),
      what,
      gated: GATED.test(src),
    }))
  })

  it("finds the known purchase points (the scan works)", () => {
    const found = new Set(hits.map((h) => h.file))
    for (const f of [
      "lib/aliexpress-ds-create-order.ts",
      "lib/suppliers/adapters/cj-dropshipping.adapter.ts",
      "lib/suppliers/rest-adapter.ts",
      "lib/china-buying/adapters/superbuy.ts",
      "lib/china-buying/adapters/anovabuy.ts",
      "lib/fulfillment/stripe-issuing-card.ts",
      "lib/auto-order/payment/index.ts",
    ]) {
      expect(found, f).toContain(f)
    }
  })

  it("every purchase point goes through the central policy / guard", () => {
    expect(hits.filter((h) => !h.gated).map((h) => `${h.file} (${h.what})`)).toEqual([])
  })

  it("the AliExpress place-order methods are only called from the guarded module", () => {
    const callers = files
      .filter((f) => /aliexpress\.ds\.order\.create/.test(code(readFileSync(f, "utf8"))))
      .map((f) => relative(ROOT, f))
    expect(callers).toEqual(["lib/aliexpress-ds-create-order.ts"])
  })

  it("the browser checkout keeps its policy check until a real pay step exists", () => {
    const src = readFileSync(join(ROOT, "lib/fulfillment/ae-browser-checkout.ts"), "utf8")
    expect(src).toMatch(/supplierPurchaseDecision\(process\.env, "aliexpress"\)/)
    expect(src).toContain("AE_BROWSER_CHECKOUT_USE_DOCKER_WORKER")
  })

  it("the auto-buy browser fallback never runs after an uncertain or guarded DS answer", () => {
    const src = readFileSync(join(ROOT, "lib/fulfillment/auto-buy.ts"), "utf8")
    expect(src).toMatch(/!ds\.uncertain && !isSupplierPurchaseGuardError\(ds\.error\)/)
  })
})
