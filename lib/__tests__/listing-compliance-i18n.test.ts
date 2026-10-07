import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import en from "@/messages/en.json"
import { READINESS_ISSUE_CODES } from "@/lib/listing-compliance/evaluate"
import { SPEC_LABEL_IDS } from "@/lib/listing-compliance/spec-labels"
import { COMPLIANCE_PROFILE_FIELDS } from "@/lib/listing-compliance/profile-shared"

const LOCALES = ["en", "fr", "de", "es", "it", "nl", "pl", "zh"] as const
type Tree = Record<string, unknown>
const load = (loc: string): Tree => JSON.parse(readFileSync(`messages/${loc}.json`, "utf8")) as Tree
const at = (root: Tree, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Tree)[k] : undefined), root)
const leaves = (o: unknown, prefix = ""): string[] =>
  o && typeof o === "object" ? Object.entries(o as Tree).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k)) : [prefix]

describe("listing compliance — translations", () => {
  const FILES = [
    "components/supplier/listing-compliance/gpsr-fields.tsx",
    "components/supplier/listing-compliance/identity-fields.tsx",
    "components/supplier/listing-compliance/listing-compliance-section.tsx",
    "components/supplier/supplier-compliance-profile-card.tsx",
    "components/supplier/guided-add-product-button.tsx",
    "components/supplier/supplier-add-product-form.tsx",
    "components/products/wizard/WizardHub.tsx",
  ]

  it.each(FILES)("every static t(\"…\") key used by %s exists in the catalogue", (file) => {
    const src = readFileSync(file, "utf8")
    const tree = at(en as Tree, "supplier.compliance") as Tree
    const used = [...src.matchAll(/\b(?:t|tCompliance|tComp)\(\s*"([A-Za-z0-9_.]+)"/g)].map((m) => m[1]!)
    // Only the compliance translators: other `t(` calls of a big form belong to other namespaces.
    const own = ["supplier-add-product-form.tsx", "guided-add-product-button.tsx", "WizardHub.tsx"].some((f) => file.endsWith(f))
      ? [...src.matchAll(/\btCompliance\(\s*"([A-Za-z0-9_.]+)"/g)].map((m) => m[1]!)
      : used
    const missing = own.filter((k) => at(tree, k) === undefined)
    expect(missing).toEqual([])
  })

  it("covers every readiness issue code and every profile validation code", () => {
    const tree = at(en as Tree, "supplier.compliance") as Tree
    for (const code of READINESS_ISSUE_CODES) expect(at(tree, `issue.${code}`), code).toBeTruthy()
    for (const code of ["invalid_email", "invalid_country", "too_long"]) expect(at(tree, `errors.${code}`), code).toBeTruthy()
    expect(COMPLIANCE_PROFILE_FIELDS.length).toBe(7)
  })

  it("has a buyer-facing label for every key the specs translator knows", () => {
    const keys = at(en as Tree, "productSpecs.keys") as Tree
    for (const id of new Set(Object.values(SPEC_LABEL_IDS))) expect(keys[id], id).toBeTruthy()
  })

  it.each(LOCALES.filter((l) => l !== "en"))("%s has exactly the same keys as English, with no empty or untranslated-copy strings", (loc) => {
    const messages = load(loc)
    for (const ns of ["supplier.compliance", "productSpecs", "supplier.bulkExcelValidation.listingNotReady"]) {
      const enLeaves = leaves(at(en as Tree, ns), ns).sort()
      const locLeaves = leaves(at(messages, ns), ns).sort()
      expect(locLeaves, `${loc}:${ns}`).toEqual(enLeaves)
    }
    const values = leaves(at(messages, "supplier.compliance"), "supplier.compliance").map((k) => at(messages, k))
    expect(values.every((v) => typeof v === "string" && v.trim().length > 0)).toBe(true)
    // Placeholders stay intact where used (none today) and no English sentence was pasted into a translation.
    expect(at(messages, "supplier.compliance.sectionTitle")).not.toBe(at(en as Tree, "supplier.compliance.sectionTitle"))
  })
})
