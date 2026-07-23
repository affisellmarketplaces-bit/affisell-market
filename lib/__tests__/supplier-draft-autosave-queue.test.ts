import { describe, expect, it } from "vitest"

import {
  createSerialAsyncQueue,
  isLatestAutosaveGeneration,
} from "@/lib/supplier-draft-autosave-queue"

describe("supplier-draft-autosave-queue", () => {
  it("runs tasks serially in order", async () => {
    const q = createSerialAsyncQueue()
    const order: number[] = []

    const a = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 30))
      order.push(1)
      return "a"
    })
    const b = q.enqueue(async () => {
      order.push(2)
      return "b"
    })

    await expect(Promise.all([a, b])).resolves.toEqual(["a", "b"])
    expect(order).toEqual([1, 2])
  })

  it("does not let a rejected task break the queue", async () => {
    const q = createSerialAsyncQueue()
    const failed = q.enqueue(async () => {
      throw new Error("boom")
    })
    await expect(failed).rejects.toThrow("boom")
    await expect(q.enqueue(async () => "ok")).resolves.toBe("ok")
  })

  it("detects stale autosave generations", () => {
    expect(isLatestAutosaveGeneration(3, 3)).toBe(true)
    expect(isLatestAutosaveGeneration(2, 3)).toBe(false)
  })
})
