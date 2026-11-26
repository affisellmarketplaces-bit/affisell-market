import { describe, expect, it } from "vitest"

import type { FamilyRecord } from "@/lib/strategic-intelligence/journal"
import { applyLearnedPriorities, familyLearning, priorityChangeAuditId } from "@/lib/strategic-intelligence/learned-priority"
import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

const rec = (actedImproved: number, actedMeasured: number, notActedImproved: number, notActedMeasured: number): FamilyRecord => ({
  measured: actedMeasured + notActedMeasured,
  actedImproved,
  actedMeasured,
  notActedImproved,
  notActedMeasured,
})

function sig(id: string, priority: StrategicSignal["priority"]): StrategicSignal {
  return {
    id,
    domain: "supplier",
    priority,
    kind: "fact",
    title: id,
    evidence: [],
    source: { id: "affisell.orders", query: "q" },
    observedAt: "2026-11-17T08:00:00.000Z",
    window: null,
    confidence: "high",
    confidenceReason: "r",
    recommendedAction: "a",
    link: null,
  }
}

describe("familyLearning — data first, then a comparison", () => {
  it("too few acted outcomes → données insuffisantes, nothing moves", () => {
    expect(familyLearning(undefined).state).toBe("insufficient")
    expect(familyLearning(rec(9, 9, 0, 30)).state).toBe("insufficient")
  })

  it("promotion needs a comparison with 'not acted'", () => {
    // 9/10 improved after acting, but no not-acted results: a raw share never promotes.
    expect(familyLearning(rec(9, 10, 0, 3)).state).toBe("keep")
    expect(familyLearning(rec(9, 12, 2, 12)).state).toBe("promote")
  })

  it("acting clearly less often followed by improvement → demote", () => {
    expect(familyLearning(rec(1, 15, 9, 15)).state).toBe("demote")
  })

  it("no clear difference → keep", () => {
    expect(familyLearning(rec(5, 12, 5, 12)).state).toBe("keep")
  })

  it("without a comparison, demotion only when even the 95 % upper bound is tiny", () => {
    expect(familyLearning(rec(0, 40, 0, 0)).state).toBe("demote")
    expect(familyLearning(rec(0, 10, 0, 0)).state).toBe("keep") // upper bound ~28 %: not enough to say
  })
})

describe("applyLearnedPriorities", () => {
  const byFamily = { "supplier:slow": rec(1, 15, 9, 15), "discovery:emerging": rec(9, 12, 2, 12) }

  it("moves one step at most, never critical, never syntheses; writes its basis and the causality caveat", () => {
    const { signals, changes } = applyLearnedPriorities(
      [
        sig("supplier:slow:s1", "important"),
        sig("supplier:slow:s2", "critical"),
        sig("discovery:emerging:p1", "study"),
        sig("discovery:emerging:p2", "important"),
        sig("synthesis:supplier:s1", "important"),
        sig("risk:quality:product:p9", "important"),
      ],
      { ...byFamily, "synthesis:supplier": rec(0, 40, 0, 0) }
    )
    const by = Object.fromEntries(signals.map((s) => [s.id, s.priority]))
    expect(by).toEqual({
      "supplier:slow:s1": "study",
      "supplier:slow:s2": "critical",
      "discovery:emerging:p1": "important",
      "discovery:emerging:p2": "important",
      "synthesis:supplier:s1": "important",
      "risk:quality:product:p9": "important",
    })
    expect(changes.map((c) => [c.signalId, c.from, c.to])).toEqual([
      ["supplier:slow:s1", "important", "study"],
      ["discovery:emerging:p1", "study", "important"],
    ])
    const moved = signals.find((s) => s.id === "supplier:slow:s1")!
    expect(moved.evidence.at(-1)!.value).toMatch(/pas une preuve de causalité/)
  })

  it("the trace id is deterministic per family, direction and basis", () => {
    const { changes } = applyLearnedPriorities([sig("supplier:slow:a", "important"), sig("supplier:slow:b", "important")], byFamily)
    expect(new Set(changes.map(priorityChangeAuditId)).size).toBe(1)
    expect(priorityChangeAuditId(changes[0])).toBe("intel-priority:supplier:slow:important>study:1/15:9/15")
  })
})
