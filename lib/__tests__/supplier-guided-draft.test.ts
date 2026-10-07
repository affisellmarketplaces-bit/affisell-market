import { describe, expect, it } from "vitest"

import {
  GUIDED_DRAFT_MAX_AGE_MS,
  GUIDED_MAX_PHOTOS,
  buildGuidedDraft,
  clearGuidedDraft,
  guidedDraftKey,
  isMeaningfulGuidedForm,
  parseGuidedDraft,
  readGuidedDraft,
  sanitizeGuidedDraftForm,
  writeGuidedDraft,
  type GuidedDraftForm,
  type StorageLike,
} from "@/lib/supplier-guided-draft"

const CATS = ["Fashion", "Home", "Beauty", "Food"] as const
const NOW = 1_800_000_000_000
const form = (over: Partial<GuidedDraftForm> = {}): GuidedDraftForm => ({
  title: "Lampe en lin", category: "Home", leafId: "leaf_1", leafBreadcrumb: "Home > Lamps", description: "Une lampe de chevet en lin lavé.",
  descriptionBullets: ["Lin lavé"], material: "Lin", color: "Écru", dimensions: "30×20 cm", stock: "12", price: "19.90",
  imageUrl: "https://cdn.example.com/a.jpg", extraImages: ["https://cdn.example.com/b.jpg"], compliance: { gpsr_manufacturer_name: "Atelier Dupont" }, ...over,
})
const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe("sanitizeGuidedDraftForm — everything read back is untrusted", () => {
  it("keeps a valid form as is", () => {
    expect(sanitizeGuidedDraftForm(form(), CATS)).toEqual(form())
  })

  it("rejects non-objects and drops unknown fields", () => {
    expect(sanitizeGuidedDraftForm(null, CATS)).toBeNull()
    expect(sanitizeGuidedDraftForm([], CATS)).toBeNull()
    expect(sanitizeGuidedDraftForm("x", CATS)).toBeNull()
    expect(sanitizeGuidedDraftForm({ ...form(), isAdmin: true, __proto__: { x: 1 } }, CATS)).not.toHaveProperty("isAdmin")
  })

  it("only accepts https photo URLs (no javascript:, data:, http:), de-duplicated and capped", () => {
    const f = sanitizeGuidedDraftForm(
      {
        ...form(),
        imageUrl: "javascript:alert(1)",
        extraImages: ["https://cdn/x.jpg", "http://cdn/y.jpg", "data:image/png;base64,AAA", "https://cdn/x.jpg", ...Array.from({ length: 20 }, (_, i) => `https://cdn/${i}.jpg`)],
      },
      CATS
    )!
    expect(f.imageUrl).toBe("")
    expect(f.extraImages.every((u) => u.startsWith("https://"))).toBe(true)
    expect(new Set(f.extraImages).size).toBe(f.extraImages.length)
    expect(f.extraImages.length).toBeLessThanOrEqual(GUIDED_MAX_PHOTOS - 1)
  })

  it("the main photo is never repeated in the extras", () => {
    expect(sanitizeGuidedDraftForm(form({ extraImages: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/c.jpg"] }), CATS)!.extraImages).toEqual(["https://cdn.example.com/c.jpg"])
  })

  it("validates the category against the wizard's own list, and numbers as numbers", () => {
    const f = sanitizeGuidedDraftForm({ ...form(), category: "Weapons", stock: "12; DROP", price: "abc" }, CATS)!
    expect(f.category).toBe("")
    expect(f.stock).toBe("")
    expect(f.price).toBe("")
    expect(sanitizeGuidedDraftForm({ ...form(), price: "19,90", stock: "0" }, CATS)).toMatchObject({ price: "19,90", stock: "0" })
  })

  it("keeps only whitelisted safety/identity keys, trimmed of blanks", () => {
    const f = sanitizeGuidedDraftForm({ ...form(), compliance: { gpsr_manufacturer_name: "A", ean: "4006381333931", evil: "x", gpsr_notice: "  ", brand: 12 } }, CATS)!
    expect(f.compliance).toEqual({ gpsr_manufacturer_name: "A", ean: "4006381333931" })
  })

  it("bounds every text field", () => {
    const f = sanitizeGuidedDraftForm({ ...form(), title: "t".repeat(500), description: "d".repeat(50_000), descriptionBullets: Array.from({ length: 50 }, () => "b".repeat(1000)) }, CATS)!
    expect(f.title).toHaveLength(120)
    expect(f.description).toHaveLength(8000)
    expect(f.descriptionBullets).toHaveLength(10)
    expect(f.descriptionBullets[0]).toHaveLength(300)
  })
})

describe("meaningful drafts and the store round trip", () => {
  it("an empty wizard is not worth keeping", () => {
    const blank = sanitizeGuidedDraftForm({}, CATS)!
    expect(isMeaningfulGuidedForm(blank)).toBe(false)
    expect(isMeaningfulGuidedForm(form())).toBe(true)
    expect(isMeaningfulGuidedForm({ ...blank, imageUrl: "https://cdn/x.jpg" })).toBe(true)
  })

  it("writes, reads back and clears, scoped to the supplier", () => {
    const s = memory()
    writeGuidedDraft(s, buildGuidedDraft({ supplierId: "sup_1", form: form(), step: 2, now: NOW }))
    expect(s.data.has(guidedDraftKey("sup_1"))).toBe(true)
    expect(readGuidedDraft(s, "sup_1", CATS, NOW + 1000)).toMatchObject({ step: 2, form: form() })
    expect(readGuidedDraft(s, "sup_2", CATS, NOW + 1000)).toBeNull() // another account on the same browser
    clearGuidedDraft(s, "sup_1")
    expect(readGuidedDraft(s, "sup_1", CATS, NOW + 1000)).toBeNull()
  })

  it("expires after a week and refuses a draft dated in the future", () => {
    const raw = JSON.stringify(buildGuidedDraft({ supplierId: "sup_1", form: form(), step: 0, now: NOW }))
    expect(parseGuidedDraft(raw, "sup_1", CATS, NOW + GUIDED_DRAFT_MAX_AGE_MS - 1)).not.toBeNull()
    expect(parseGuidedDraft(raw, "sup_1", CATS, NOW + GUIDED_DRAFT_MAX_AGE_MS + 1)).toBeNull()
    expect(parseGuidedDraft(raw, "sup_1", CATS, NOW - 10 * 60_000)).toBeNull()
  })

  it("rejects corrupt, foreign-version or tampered payloads without throwing", () => {
    for (const raw of [null, "", "not json", "[]", "null", JSON.stringify({ v: 99 }), JSON.stringify({ v: 1, supplierId: "other", savedAt: NOW, step: 0, form: form() })]) {
      expect(parseGuidedDraft(raw, "sup_1", CATS, NOW)).toBeNull()
    }
    const tampered = JSON.stringify({ v: 1, supplierId: "sup_1", savedAt: NOW, step: 99, form: { ...form(), imageUrl: "javascript:alert(1)" } })
    const parsed = parseGuidedDraft(tampered, "sup_1", CATS, NOW)!
    expect(parsed.step).toBe(3) // clamped
    expect(parsed.form.imageUrl).toBe("")
  })

  it("never throws when storage is unavailable or full", () => {
    const broken: StorageLike = { getItem: () => { throw new Error("denied") }, setItem: () => { throw new Error("quota") }, removeItem: () => { throw new Error("denied") } }
    expect(() => writeGuidedDraft(broken, buildGuidedDraft({ supplierId: "s", form: form(), step: 0, now: NOW }))).not.toThrow()
    expect(readGuidedDraft(broken, "s", CATS, NOW)).toBeNull()
    expect(() => clearGuidedDraft(broken, "s")).not.toThrow()
    expect(readGuidedDraft(null, "s", CATS, NOW)).toBeNull()
  })
})
