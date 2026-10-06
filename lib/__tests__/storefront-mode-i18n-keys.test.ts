import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { deriveStorefrontMode } from "@/lib/storefront/storefront-mode"

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const

type Tree = { [k: string]: string | Tree }
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === "string") acc[`${prefix}${k}`] = v
    else Object.assign(acc, flatten(v, `${prefix}${k}.`))
    return acc
  }, {})
}
const messages = (locale: string) =>
  flatten(
    (JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../messages/${locale}.json`), "utf8")) as {
      storefront: { mode: Tree }
    }).storefront.mode
  )

// A missing key throws at render time in next-intl, and the card builds some keys from the derived stage — so every
// stage the model can produce must have its strings, in every language, with the variables the card passes.
describe("storefront type card strings", () => {
  const reference = messages("en")

  it.each(LOCALES)("%s carries every key, non-empty", (locale) => {
    const keys = messages(locale)
    expect(Object.keys(keys).sort()).toEqual(Object.keys(reference).sort())
    for (const [k, v] of Object.entries(keys)) expect(v.trim().length, `${locale}:${k}`).toBeGreaterThan(0)
  })

  it.each(LOCALES)("%s keeps the interpolation variables", (locale) => {
    const keys = messages(locale)
    expect(keys["ariaLabel"]).toContain("{type}")
    expect(keys["vitrine.body"]).toContain("{address}")
    expect(keys["brand.body"]).toContain("{domain}")
  })

  it("has a progress label and (except for live) a hint for every stage the model can produce", () => {
    const stages = new Set(
      [
        { customDomain: null },
        { customDomain: "a.co", domainVerified: false },
        { customDomain: "a.co", domainVerified: true, vercelDomainStatus: "pending", vercelAutoProvision: true },
        { customDomain: "a.co", domainVerified: true, vercelDomainStatus: "failed", vercelAutoProvision: true },
        { customDomain: "a.co", domainVerified: true, vercelDomainStatus: "active", vercelAutoProvision: true },
      ].map((s) => deriveStorefrontMode(s).stage)
    )
    expect([...stages].sort()).toEqual(["dns_pending", "live", "none", "ssl_failed", "ssl_pending"])
    for (const stage of stages) {
      expect(reference[`progress.${stage}`], `progress.${stage}`).toBeTruthy()
      if (stage !== "live") expect(reference[`hints.${stage}`], `hints.${stage}`).toBeTruthy()
    }
  })
})
