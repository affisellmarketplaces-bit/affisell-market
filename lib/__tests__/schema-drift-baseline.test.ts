import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  compareToBaseline,
  formatDriftReport,
  normalizeDiffScript,
  validateBaseline,
  type SchemaDriftBaseline,
} from "@/lib/schema-drift/baseline"

const root = path.resolve(__dirname, "../..")
const baseline = JSON.parse(readFileSync(path.join(root, "prisma/schema-drift-baseline.json"), "utf8")) as SchemaDriftBaseline
/** The exact `prisma migrate diff` of CI run 45451931608 and the catalogue facts of a chain-built PostgreSQL 16. */
const diff = readFileSync(path.join(__dirname, "fixtures/schema-drift-prisma-diff-438a828ea.sql"), "utf8")
const catalog = readFileSync(path.join(__dirname, "fixtures/schema-drift-catalog-facts.txt"), "utf8")
const clone = (): SchemaDriftBaseline => JSON.parse(JSON.stringify(baseline))

describe("schema-drift baseline — the file itself", () => {
  it("is valid", () => {
    expect(validateBaseline(baseline)).toEqual([])
  })

  it("lists exactly the historical divergences decided on 2026-11-24 (adding one means changing this test too)", () => {
    const by = (c: string) => baseline.entries.filter((e) => e.category === c).length
    expect(baseline.entries).toHaveLength(20)
    expect(by("extra_index")).toBe(8)
    expect(by("unmodelled_default")).toBe(4)
    expect(by("timestamp_type")).toBe(6)
    expect(by("partial_unique_index")).toBe(1)
    expect(by("truncated_index_name")).toBe(1)
    expect(baseline.nonPrismaConstraints.map((c) => c.fact.key)).toEqual([
      "SponsorCampaignCharge.SponsorCampaignCharge_status_check",
    ])
    expect(baseline.checkedTables).toEqual(["SponsorCampaign", "SponsorCampaignCharge", "AdminAeCaptureSession"])
  })

  it("never mentions a repaired lineage object: the repairs are checked, never excused", () => {
    for (const e of baseline.entries) expect(e.statement).not.toMatch(/SponsorCampaign|AdminAeCaptureSession/)
  })

  it("keeps the Stripe transfer index as a HIGH risk entry pointing at its follow-up", () => {
    const e = baseline.entries.find((x) => x.id === "stripe-transfer-unique-partial")!
    expect(e.risk).toMatch(/^HIGH/)
    expect(e.reason).toContain("docs/STRIPE-TRANSFER-UNIQUE-INDEX.md")
  })

  it("rejects a baseline that would weaken the check", () => {
    const pattern = clone(); pattern.entries[0].statement = 'DROP INDEX "Order_%"'
    expect(validateBaseline(pattern).join()).toMatch(/motif interdit/)
    const noReason = clone(); noReason.entries[1].reason = " "
    expect(validateBaseline(noReason).join()).toMatch(/justification absente/)
    const dup = clone(); dup.entries.push({ ...dup.entries[0] })
    expect(validateBaseline(dup).join()).toMatch(/en double/)
    const two = clone(); two.entries[0].statement = 'DROP INDEX "A"; DROP INDEX "B"'
    expect(validateBaseline(two).join()).toMatch(/une seule instruction|terminée/)
    const unknownCat = clone(); (unknownCat.entries[0] as { category: string }).category = "anything"
    expect(validateBaseline(unknownCat).join()).toMatch(/catégorie inconnue/)
    const outside = clone(); outside.nonPrismaConstraints[0].fact.key = "Order.some_check"
    expect(validateBaseline(outside).join()).toMatch(/hors du périmètre/)
    expect(validateBaseline({ format: "other" })).toEqual(["format inconnu (affisell.schema-drift-baseline attendu)"])
  })
})

describe("normalizeDiffScript", () => {
  it("splits multi-clause ALTER TABLE into one statement per column, never inside parentheses", () => {
    const s = normalizeDiffScript('-- AlterTable\nALTER TABLE "T" ALTER COLUMN "a" SET DATA TYPE DECIMAL(10,2),\nALTER COLUMN "b" DROP DEFAULT;\n')
    expect(s).toEqual([
      'ALTER TABLE "T" ALTER COLUMN "a" SET DATA TYPE DECIMAL(10,2)',
      'ALTER TABLE "T" ALTER COLUMN "b" DROP DEFAULT',
    ])
  })
  it("reads the recorded CI diff as exactly the 20 baseline statements", () => {
    expect(normalizeDiffScript(diff).sort()).toEqual(baseline.entries.map((e) => e.statement).sort())
  })
})

describe("compareToBaseline — positive and negative cases", () => {
  it("accepts the recorded diff and catalogue (and only those)", () => {
    const v = compareToBaseline(baseline, diff, catalog)
    expect(v.ok).toBe(true)
    expect(v.accepted).toHaveLength(20)
  })

  it("REJECTS a new divergence", () => {
    const v = compareToBaseline(baseline, `${diff}\n-- AlterTable\nALTER TABLE "Order" ADD COLUMN "zz_unexpected" TEXT;\n`, catalog)
    expect(v.ok).toBe(false)
    expect(v.unexpected).toEqual(['ALTER TABLE "Order" ADD COLUMN "zz_unexpected" TEXT'])
    expect(formatDriftReport(v, "n1", baseline)).toContain("NOUVELLE divergence")
  })

  it("REJECTS a baseline divergence that disappears (fixed or renamed without updating the baseline)", () => {
    const v = compareToBaseline(baseline, diff.replace('DROP INDEX "Order_trackingLockedAt_idx";', ""), catalog)
    expect(v.ok).toBe(false)
    expect(v.disappeared.map((d) => d.id)).toEqual(["extra-index-order-tracking-locked-at"])
  })

  it("REJECTS an existing divergence modified underneath the same Prisma statement", () => {
    const changed = catalog.replace('USING btree ("parentId")', 'USING btree ("slug")')
    const v = compareToBaseline(baseline, diff, changed)
    expect(v.ok).toBe(false)
    expect(v.modified.map((m) => m.id)).toEqual(["extra-index-category-parent"])
    const def = compareToBaseline(baseline, diff, catalog.replace("integer | 0", "integer | 1"))
    expect(def.modified.map((m) => m.id)).toEqual(["default-ingnudgelog-groupscount"])
  })

  it("REJECTS a missing Stripe partial unique index even though Prisma still asks for the same CREATE", () => {
    const gone = catalog.split("\n").filter((l) => !l.startsWith("index|MerchantPayoutLedger_stripeTransferId_key|")).join("\n")
    const v = compareToBaseline(baseline, diff, gone)
    expect(v.modified).toEqual([expect.objectContaining({ id: "stripe-transfer-unique-partial", observed: "<absent>" })])
  })

  it("REJECTS a new CHECK constraint on a repaired table, and a changed or missing listed one", () => {
    const extra = compareToBaseline(baseline, diff, `${catalog}\ncheck|AdminAeCaptureSession.zz_check|CHECK ((1 = 1))`)
    expect(extra.unexpectedConstraints.map((c) => c.key)).toEqual(["check|AdminAeCaptureSession.zz_check"])
    const changed = compareToBaseline(baseline, diff, catalog.replace("'REVERSED'::text", "'OTHER'::text"))
    expect(changed.constraintMismatches.map((c) => c.id)).toEqual(["check-sponsorcampaigncharge-status"])
  })

  it("REJECTS a statement emitted twice and a catalogue listing an object twice", () => {
    expect(compareToBaseline(baseline, `${diff}\nDROP INDEX "Category_parentId_idx";`, catalog).unexpected[0]).toMatch(/émise 2 fois/)
    const firstLine = catalog.split("\n")[0]
    expect(compareToBaseline(baseline, diff, `${catalog}\n${firstLine}`).catalogDuplicates).toHaveLength(1)
  })

  it("does not compare at all with an invalid baseline", () => {
    const bad = clone(); bad.entries[0].reason = ""
    const v = compareToBaseline(bad, diff, catalog)
    expect(v.ok).toBe(false)
    expect(formatDriftReport(v, "bad", bad)).toContain("Baseline invalide")
  })
})
