import { describe, expect, it } from "vitest"

import { isGpsrCompliant } from "@/lib/legal/gpsr-compliance-shared"
import { isEuCountry, isCountryCode } from "@/lib/listing-compliance/eu-countries"
import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { gtinCheckDigit, isValidGtin, normalizeGtin } from "@/lib/listing-compliance/gtin"
import { CANONICAL_LABELS, GPSR_KEYS, IDENTITY_KEYS, LISTING_COMPLIANCE_KEYS, isListingComplianceKey } from "@/lib/listing-compliance/keys"
import { decideListingReadiness, listingNotReadyBody, readListingReadinessMode } from "@/lib/listing-compliance/mode"
import { HIDDEN_SPEC_KEYS, SPEC_LABEL_IDS, localizeSpecLabel } from "@/lib/listing-compliance/spec-labels"
import { mergeManagedProductAttributes, parseManagedAttributeKeys } from "@/lib/supplier-product-attributes"

const k = GPSR_KEYS
const EU_MANUFACTURER = {
  [k.manufacturerName]: "Atelier Dupont SAS",
  [k.manufacturerAddress]: "12 rue des Lilas, 75011 Paris",
  [k.manufacturerEmail]: "contact@dupont.fr",
  [k.manufacturerCountry]: "FR",
}
const codes = (r: ReturnType<typeof evaluateListingReadiness>) => r.issues.map((i) => i.code).sort()

describe("GTIN", () => {
  it.each(["4006381333931", "978-3-16-148410-0", "96385074", "036000291452", "10012345678902"])("accepts %s", (g) => {
    expect(isValidGtin(g)).toBe(true)
  })
  it.each(["4006381333932", "123", "abcdefghijklm", "", "12345678901234567", "978316148410"])("rejects %s", (g) => {
    expect(isValidGtin(g)).toBe(false)
  })
  it("normalises separators and computes the check digit", () => {
    expect(normalizeGtin(" 978-3-16.148410 0 ")).toBe("9783161484100")
    expect(gtinCheckDigit("400638133393")).toBe(1)
  })
})

describe("EU countries", () => {
  it("knows the 27 member states, and treats the UK, CH, NO, CN as outside", () => {
    expect([...["FR", "DE", "ES", "IE", "PL"]].every(isEuCountry)).toBe(true)
    expect(["GB", "CH", "NO", "CN", "US", "TR"].some(isEuCountry)).toBe(false)
    expect(isEuCountry(" fr ")).toBe(true)
  })
  it("validates the shape of a country code", () => {
    expect(isCountryCode("FR")).toBe(true)
    expect(isCountryCode("france")).toBe(false)
    expect(isCountryCode("F")).toBe(false)
  })
})

describe("evaluateListingReadiness", () => {
  it("is not applicable to digital goods, services and experiences", () => {
    for (const listingKind of ["SOFTWARE", "SUBSCRIPTION", "SERVICE", "EXPERIENCE"]) {
      const r = evaluateListingReadiness({ listingKind, attributes: [] })
      expect(r).toMatchObject({ applicable: false, ready: true, issues: [] })
    }
  })

  it("treats an unknown / empty kind as PHYSICAL (the database default)", () => {
    expect(evaluateListingReadiness({ listingKind: undefined, attributes: [] }).applicable).toBe(true)
    expect(evaluateListingReadiness({ listingKind: " physical ", attributes: [] }).applicable).toBe(true)
  })

  it("blocks a physical product with no manufacturer information at all", () => {
    const r = evaluateListingReadiness({ listingKind: "PHYSICAL", attributes: [] })
    expect(r.ready).toBe(false)
    expect(r.blocking.map((i) => i.code).sort()).toEqual([
      "gpsr_manufacturer_address_missing",
      "gpsr_manufacturer_country_missing",
      "gpsr_manufacturer_email_missing",
      "gpsr_manufacturer_name_missing",
    ])
  })

  it("is ready with an EU manufacturer — and only advisories remain (GTIN, brand)", () => {
    const r = evaluateListingReadiness({ listingKind: "PHYSICAL", attributes: EU_MANUFACTURER })
    expect(r.ready).toBe(true)
    expect(r.blocking).toEqual([])
    expect(codes(r)).toEqual(["brand_missing", "gtin_missing"])
  })

  it("requires an EU responsible person when the manufacturer is established outside the EU", () => {
    const base = { ...EU_MANUFACTURER, [k.manufacturerCountry]: "CN" }
    expect(codes(evaluateListingReadiness({ attributes: base }))).toEqual([
      "brand_missing",
      "gpsr_eu_rep_address_missing",
      "gpsr_eu_rep_email_missing",
      "gpsr_eu_rep_name_missing",
      "gtin_missing",
    ])
    const withRep = {
      ...base,
      [k.euRepName]: "Affisell Import SARL",
      [k.euRepAddress]: "1 avenue de la République, 69003 Lyon",
      [k.euRepEmail]: "gpsr@import.fr",
    }
    expect(evaluateListingReadiness({ attributes: withRep }).ready).toBe(true)
    expect(evaluateListingReadiness({ attributes: { ...withRep, [k.euRepEmail]: "pas-un-email" } }).blocking.map((i) => i.code)).toEqual([
      "gpsr_eu_rep_email_invalid",
    ])
  })

  it("does not ask for an EU responsible person when the country is missing or invalid (the country is the blocker)", () => {
    const noCountry = { ...EU_MANUFACTURER, [k.manufacturerCountry]: "" }
    expect(evaluateListingReadiness({ attributes: noCountry }).blocking.map((i) => i.code)).toEqual(["gpsr_manufacturer_country_missing"])
    const bad = { ...EU_MANUFACTURER, [k.manufacturerCountry]: "Chine" }
    expect(evaluateListingReadiness({ attributes: bad }).blocking.map((i) => i.code)).toEqual(["gpsr_manufacturer_country_invalid"])
  })

  it("flags an invalid manufacturer email", () => {
    const r = evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [k.manufacturerEmail]: "nope" } })
    expect(r.blocking.map((i) => i.code)).toEqual(["gpsr_manufacturer_email_invalid"])
    expect(r.blocking[0]).toMatchObject({ field: k.manufacturerEmail, group: "gpsr" })
  })

  it("keeps the same email rule as the guided wizard's isGpsrCompliant (no drift)", () => {
    for (const email of ["a@b.co", "a@b", "a b@c.de", "", "x@y.z", "@a.b", "ok@ok.fr "]) {
      const wizard = isGpsrCompliant({ manufacturerName: "n", manufacturerAddress: "a", manufacturerEmail: email }).compliant
      const mine = !evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [k.manufacturerEmail]: email } }).blocking.some((i) =>
        i.code.startsWith("gpsr_manufacturer_email")
      )
      expect(mine).toBe(wizard)
    }
  })

  it("GTIN: valid is clean, malformed is blocking, absent is advisory unless declared exempt", () => {
    const ok = evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [IDENTITY_KEYS.gtin]: "4006381333931", [IDENTITY_KEYS.brand]: "Acme" } })
    expect(ok.issues).toEqual([])
    const bad = evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [IDENTITY_KEYS.gtin]: "4006381333932", [IDENTITY_KEYS.brand]: "Acme" } })
    expect(bad.blocking.map((i) => i.code)).toEqual(["gtin_invalid"])
    const exempt = evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [IDENTITY_KEYS.gtinExempt]: "1", [IDENTITY_KEYS.brand]: "Acme" } })
    expect(exempt.issues).toEqual([])
  })

  it("brand: empty or a generic placeholder is only an advisory", () => {
    for (const brand of ["", "Générique", "generic", "Sans marque", "N/A"]) {
      const r = evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [IDENTITY_KEYS.brand]: brand, [IDENTITY_KEYS.gtinExempt]: "1" } })
      expect(codes(r)).toEqual(["brand_missing"])
      expect(r.ready).toBe(true)
    }
  })

  it("accepts attributes as rows or as a record, trimming values", () => {
    const rows = Object.entries(EU_MANUFACTURER).map(([key, value]) => ({ key, value: `  ${value}  ` }))
    expect(evaluateListingReadiness({ attributes: rows }).ready).toBe(true)
    expect(evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [k.manufacturerName]: "   " } }).ready).toBe(false)
  })
})

describe("rollout mode", () => {
  const dirty = evaluateListingReadiness({ attributes: [] })
  const clean = evaluateListingReadiness({ attributes: { ...EU_MANUFACTURER, [IDENTITY_KEYS.brand]: "Acme", [IDENTITY_KEYS.gtinExempt]: "1" } })

  it("defaults to warn; reads off / enforce and common spellings", () => {
    expect(readListingReadinessMode(undefined)).toBe("warn")
    expect(readListingReadinessMode("")).toBe("warn")
    expect(readListingReadinessMode("nonsense")).toBe("warn")
    for (const v of ["off", "0", "FALSE", " Off "]) expect(readListingReadinessMode(v)).toBe("off")
    for (const v of ["enforce", "ENFORCED", "block"]) expect(readListingReadinessMode(v)).toBe("enforce")
  })

  it("warn logs but never blocks; off does nothing", () => {
    expect(decideListingReadiness(dirty, "new_publication", "warn")).toMatchObject({ block: false, log: true })
    expect(decideListingReadiness(dirty, "new_publication", "off")).toMatchObject({ block: false, log: false, issues: [] })
  })

  it("enforce blocks only NEW publications — never the edit of a listing that is already live", () => {
    expect(decideListingReadiness(dirty, "new_publication", "enforce").block).toBe(true)
    // ...and it is not logged either: a live listing is re-saved on every autosave.
    expect(decideListingReadiness(dirty, "live_edit", "enforce")).toMatchObject({ block: false, log: false })
  })

  it("enforce does not block on advisories alone, and a clean listing is not even logged", () => {
    const advisoryOnly = evaluateListingReadiness({ attributes: EU_MANUFACTURER })
    expect(decideListingReadiness(advisoryOnly, "new_publication", "enforce").block).toBe(false)
    expect(decideListingReadiness(clean, "new_publication", "enforce")).toMatchObject({ block: false, log: false })
  })

  it("never blocks digital goods", () => {
    const digital = evaluateListingReadiness({ listingKind: "SOFTWARE", attributes: [] })
    expect(decideListingReadiness(digital, "new_publication", "enforce").block).toBe(false)
  })

  it("the 422 body carries codes only (language-neutral)", () => {
    const body = listingNotReadyBody(decideListingReadiness(dirty, "new_publication", "enforce"))
    expect(body.error).toBe("listing_not_ready")
    expect(body.issues.length).toBeGreaterThan(0)
    expect(Object.keys(body.issues[0]!).sort()).toEqual(["code", "field", "group", "severity"])
  })
})

describe("managed attribute keys (no more silent wipe)", () => {
  const existing = [
    { key: "material", label: "Matériau", value: "Coton" },
    { key: k.manufacturerName, label: "Fabricant", value: "Atelier Dupont" },
    { key: "brand", label: "Marque", value: "Acme" },
  ]

  it("legacy contract: without a managed list the incoming set replaces everything", () => {
    const incoming = [{ key: "brand", label: "Marque", value: "Nova" }]
    expect(mergeManagedProductAttributes(existing, incoming, null)).toEqual(incoming)
  })

  it("with a managed list, rows the form does not own survive (a classic-form save keeps guided data)", () => {
    const incoming = [{ key: "brand", label: "Marque", value: "Nova" }]
    const out = mergeManagedProductAttributes(existing, incoming, ["brand", "size"])
    expect(out.map((r) => `${r.key}=${r.value}`).sort()).toEqual(["brand=Nova", `${k.manufacturerName}=Atelier Dupont`, "material=Coton"])
  })

  it("a managed key that is no longer sent is removed — that is how a form clears a field", () => {
    const out = mergeManagedProductAttributes(existing, [], ["brand", k.manufacturerName])
    expect(out).toEqual([{ key: "material", label: "Matériau", value: "Coton" }])
  })

  it("the incoming value wins over a preserved row with the same key", () => {
    const out = mergeManagedProductAttributes(existing, [{ key: "material", label: "Material", value: "Lin" }], ["brand"])
    expect(out.filter((r) => r.key === "material")).toEqual([{ key: "material", label: "Material", value: "Lin" }])
  })

  it("after a category change, the old category's characteristics go (as before) but product-level data stays", () => {
    const rows = [
      { key: "item_volume_ml", label: "Volume", value: "250" }, // characteristic of the OLD category
      { key: "material", label: "Matériau", value: "Coton" }, // describes the product itself
      { key: k.manufacturerName, label: "Fabricant", value: "Atelier Dupont" }, // safety data
    ]
    const out = mergeManagedProductAttributes(rows, [], ["brand"], { categoryChanged: true, alwaysKeep: new Set(LISTING_COMPLIANCE_KEYS) })
    expect(out.map((r) => r.key).sort()).toEqual([k.manufacturerName, "material"].sort())
    // same save WITHOUT a category change keeps every row the form does not own
    expect(mergeManagedProductAttributes(rows, [], ["brand"]).map((r) => r.key)).toHaveLength(3)
  })

  it("parses and bounds the declared keys", () => {
    expect(parseManagedAttributeKeys(undefined)).toBeNull()
    expect(parseManagedAttributeKeys([])).toBeNull()
    expect(parseManagedAttributeKeys(["a", " a ", 3, "", "b"])).toEqual(["a", "b"])
    expect(parseManagedAttributeKeys(Array.from({ length: 500 }, (_, i) => `k${i}`))).toHaveLength(300)
  })
})

describe("reserved keys and spec labels", () => {
  it("reuses the keys that already exist in the catalogue (no parallel fields)", () => {
    expect(IDENTITY_KEYS.brand).toBe("brand")
    expect(IDENTITY_KEYS.gtin).toBe("ean")
    expect(GPSR_KEYS.manufacturerName).toBe("gpsr_manufacturer_name") // written by the guided wizard
    expect(isListingComplianceKey("ean")).toBe(true)
    expect(isListingComplianceKey("material")).toBe(false)
  })

  it("every reserved key has a canonical label and no duplicates", () => {
    expect(new Set(LISTING_COMPLIANCE_KEYS).size).toBe(LISTING_COMPLIANCE_KEYS.length)
    for (const key of LISTING_COMPLIANCE_KEYS) expect(CANONICAL_LABELS[key], key).toBeTruthy()
  })

  it("translates labels from the key and falls back to the stored label for unknown keys", () => {
    const t = Object.assign((key: string) => `T(${key})`, { has: (key: string) => key !== "keys.size" })
    expect(localizeSpecLabel("material", "Matériau", t)).toBe("T(keys.material)")
    expect(localizeSpecLabel(k.manufacturerName, "Fabricant", t)).toBe("T(keys.manufacturerName)")
    expect(localizeSpecLabel("item_volume_ml", "Volume (ml)", t)).toBe("Volume (ml)")
    expect(localizeSpecLabel("size", "Taille", t)).toBe("Taille") // no catalogue entry → stored label
  })

  it("hides the internal exemption flag from buyers", () => {
    expect(HIDDEN_SPEC_KEYS.has(IDENTITY_KEYS.gtinExempt)).toBe(true)
    expect(SPEC_LABEL_IDS[IDENTITY_KEYS.gtinExempt]).toBeUndefined()
  })
})
