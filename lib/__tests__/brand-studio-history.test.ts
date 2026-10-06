import { describe, expect, it } from "vitest"

import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  recordChange,
  redo,
  undo,
} from "@/lib/storefront/brand-studio-history"

const eq = (a: number, b: number) => a === b

describe("brand studio history", () => {
  it("starts with nothing to undo or redo", () => {
    const h = createHistory(1)
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it("records changes, walks back and forth", () => {
    let h = createHistory(1)
    h = recordChange(h, 2, eq)
    h = recordChange(h, 3, eq)
    expect(h.present).toBe(3)
    h = undo(h)
    expect(h.present).toBe(2)
    h = undo(h)
    expect(h.present).toBe(1)
    expect(canUndo(h)).toBe(false)
    h = redo(h)
    h = redo(h)
    expect(h.present).toBe(3)
    expect(canRedo(h)).toBe(false)
  })

  it("ignores a change equal to the present — which also makes feeding an undo result back in harmless", () => {
    let h = createHistory(1)
    h = recordChange(h, 2, eq)
    expect(recordChange(h, 2, eq)).toBe(h)
    const back = undo(h)
    // The studio applies the undone snapshot to its fields, then records the (now equal) snapshot again.
    expect(recordChange(back, back.present, eq)).toBe(back)
    expect(canRedo(back)).toBe(true)
  })

  it("a new change after an undo discards the redo branch", () => {
    let h = createHistory(1)
    h = recordChange(h, 2, eq)
    h = recordChange(h, 3, eq)
    h = undo(h)
    h = recordChange(h, 9, eq)
    expect(h.present).toBe(9)
    expect(canRedo(h)).toBe(false)
    expect(undo(h).present).toBe(2)
  })

  it("keeps at most HISTORY_LIMIT steps, dropping the oldest", () => {
    let h = createHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 20; i += 1) h = recordChange(h, i, eq)
    expect(h.past.length).toBe(HISTORY_LIMIT)
    // 70 changes → present 70, past = the 50 values before it (20…69): the oldest 20 (0…19) were dropped.
    expect(h.past[0]).toBe(20)
    expect(h.present).toBe(HISTORY_LIMIT + 20)
  })

  it("never mutates a previous history value", () => {
    const h0 = createHistory(1)
    const h1 = recordChange(h0, 2, eq)
    const h2 = undo(h1)
    expect(h0).toEqual({ past: [], present: 1, future: [] })
    expect(h1).toEqual({ past: [1], present: 2, future: [] })
    expect(h2).toEqual({ past: [], present: 1, future: [2] })
  })
})
