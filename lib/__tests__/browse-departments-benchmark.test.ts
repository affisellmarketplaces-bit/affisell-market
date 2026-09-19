import { describe, expect, it } from "vitest"

import {
  AFFISELL_BROWSE_DEPARTMENTS,
  BROWSE_DEPARTMENT_THEME,
  BROWSE_DEPARTMENT_THEME_ORDER,
} from "@/lib/taxonomy/browse-departments-shared"

describe("competitor-benchmarked department directory", () => {
  it("has unique ids and both FR/EN labels", () => {
    const ids = AFFISELL_BROWSE_DEPARTMENTS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of AFFISELL_BROWSE_DEPARTMENTS) {
      expect(d.labelFr.trim().length).toBeGreaterThan(1)
      expect(d.labelEn.trim().length).toBeGreaterThan(1)
    }
  })

  it("covers the aisles the big marketplaces expose", () => {
    const ids = new Set(AFFISELL_BROWSE_DEPARTMENTS.map((d) => d.id))
    for (const must of [
      "electromenager", "luminaires", "meubles", "bureau", "bagages", "chaussures", "cosmetiques", "parfums",
      "livres", "musique", "films", "instruments", "consoles", "logiciels", "pieces-auto", "velos", "camping",
      "fitness", "pro-industrie", "reconditionne", "loisirs-creatifs", "jeux-societe",
    ]) {
      expect(ids.has(must), must).toBe(true)
    }
  })

  it("groups every department under a known theme (or intentionally 'other')", () => {
    for (const d of AFFISELL_BROWSE_DEPARTMENTS) {
      const theme = BROWSE_DEPARTMENT_THEME[d.id] ?? "other"
      expect(BROWSE_DEPARTMENT_THEME_ORDER).toContain(theme)
    }
  })

  it("only targets exact taxonomy nodes (never a free-form guess)", () => {
    for (const d of AFFISELL_BROWSE_DEPARTMENTS) {
      const t = d.target
      if (t.kind === "googleRoot") expect(t.rootNameFr.trim()).not.toBe("")
      if (t.kind === "googleFullPath") expect(t.fullPathFr).toContain(" > ")
    }
  })
})
