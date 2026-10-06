import { describe, expect, it } from "vitest"

import {
  buildDraft,
  clearDraft,
  DRAFT_MAX_AGE_MS,
  draftStorageKey,
  evaluateDraft,
  parseDraft,
  readDraft,
  snapshotFingerprint,
  stableStringify,
  writeDraft,
  type StorageLike,
} from "@/lib/storefront/brand-studio-draft"
import {
  snapshotFromDraft,
  snapshotFromStore,
  snapshotsEqual,
  snapshotToStoreRow,
  type BrandStudioSnapshot,
  type BrandStudioStoreRow,
} from "@/lib/storefront/brand-studio-snapshot"

const STORE: BrandStudioStoreRow = {
  name: "Maison Aurore",
  slug: "maison-aurore",
  logoUrl: "https://cdn.example/logo.png",
  bannerUrl: null,
  description: "Des essentiels premium.",
  storefrontTheme: {
    primary: "#1d4ed8",
    accent: "#7c3aed",
    trustRailText: "Livraison UE",
    layout: "classic",
    heroStyle: "gradient",
    gridDensity: "comfortable",
    surface: "light",
  },
}

const saved: BrandStudioSnapshot = snapshotFromStore(STORE)
const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}
const NOW = 1_800_000_000_000

describe("snapshot ⇄ store row", () => {
  it("round-trips a design exactly", () => {
    const edited = snapshotFromDraft({ ...saved, name: "  Nouvelle Maison  ", primaryHex: "#0f766e", description: "Autre texte" })
    const back = snapshotFromStore(snapshotToStoreRow(edited, "maison-aurore"))
    expect(snapshotsEqual(back, edited)).toBe(true)
  })

  it("the fingerprint ignores key order but not content", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }))
    expect(snapshotFingerprint(saved)).toBe(snapshotFingerprint(snapshotFromStore(STORE)))
    expect(snapshotFingerprint({ ...saved, accent: "#000000" })).not.toBe(snapshotFingerprint(saved))
  })
})

describe("draft recovery verdicts", () => {
  const edited = { ...saved, name: "Maison Aurore Paris", primaryHex: "#0f766e" }

  it("offers a draft that was started from the current saved design", () => {
    const draft = buildDraft({ slug: "maison-aurore", snapshot: edited, base: saved, now: NOW })
    const verdict = evaluateDraft(draft, saved, NOW + 60_000)
    expect(verdict.action).toBe("restore")
    if (verdict.action === "restore") {
      expect(verdict.snapshot.name).toBe("Maison Aurore Paris")
      expect(verdict.snapshot.primaryHex).toBe("#0f766e")
      expect(snapshotsEqual(verdict.snapshot, edited)).toBe(true)
    }
  })

  it("discards a draft when the saved design changed since (never overwrite newer work)", () => {
    const draft = buildDraft({ slug: "maison-aurore", snapshot: edited, base: saved, now: NOW })
    const savedElsewhere = { ...saved, accent: "#db2777" }
    expect(evaluateDraft(draft, savedElsewhere, NOW)).toEqual({ action: "discard", reason: "stale" })
  })

  it("discards a draft identical to what is saved, and one older than a week", () => {
    const same = buildDraft({ slug: "maison-aurore", snapshot: saved, base: saved, now: NOW })
    expect(evaluateDraft(same, saved, NOW)).toEqual({ action: "discard", reason: "identical" })
    const old = buildDraft({ slug: "maison-aurore", snapshot: edited, base: saved, now: NOW })
    expect(evaluateDraft(old, saved, NOW + DRAFT_MAX_AGE_MS + 1)).toEqual({ action: "discard", reason: "expired" })
  })

  it("validates a restored draft through the theme parser — junk values cannot get in", () => {
    const draft = buildDraft({ slug: "maison-aurore", snapshot: edited, base: saved, now: NOW })
    const tampered = JSON.parse(JSON.stringify(draft))
    tampered.row.storefrontTheme.primary = "not-a-color"
    tampered.row.storefrontTheme.layout = "<script>"
    const verdict = evaluateDraft(tampered, saved, NOW)
    expect(verdict.action).toBe("restore")
    if (verdict.action === "restore") {
      expect(verdict.snapshot.primaryHex).toMatch(/^#[0-9a-f]{6}$/i)
      expect(["classic", "immersive", "editorial"]).toContain(verdict.snapshot.layout)
    }
  })
})

describe("draft storage", () => {
  it("writes, reads and clears under a per-store key", () => {
    const storage = memory()
    const draft = buildDraft({ slug: "Maison-Aurore", snapshot: { ...saved, name: "X" }, base: saved, now: NOW })
    writeDraft(storage, draft)
    expect([...storage.data.keys()]).toEqual([draftStorageKey("maison-aurore")])
    expect(readDraft(storage, "Maison-Aurore")?.row.name).toBe("X")
    clearDraft(storage, "Maison-Aurore")
    expect(readDraft(storage, "Maison-Aurore")).toBeNull()
  })

  it("rejects garbage, wrong versions and other stores' drafts", () => {
    expect(parseDraft("not json", "s")).toBeNull()
    expect(parseDraft(null, "s")).toBeNull()
    expect(parseDraft(JSON.stringify({ v: 99, slug: "s", savedAt: 1, baseKey: "k", row: { name: "n" } }), "s")).toBeNull()
    expect(parseDraft(JSON.stringify({ v: 1, slug: "other", savedAt: 1, baseKey: "k", row: { name: "n" } }), "s")).toBeNull()
    expect(parseDraft(JSON.stringify({ v: 1, slug: "s", savedAt: "x", baseKey: "k", row: { name: "n" } }), "s")).toBeNull()
  })

  it("never throws when storage is unavailable or full", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("quota")
      },
      removeItem: () => {
        throw new Error("denied")
      },
    }
    const draft = buildDraft({ slug: "s", snapshot: saved, base: saved, now: NOW })
    expect(() => writeDraft(broken, draft)).not.toThrow()
    expect(() => clearDraft(broken, "s")).not.toThrow()
    expect(readDraft(broken, "s")).toBeNull()
    expect(readDraft(null, "s")).toBeNull()
  })
})
