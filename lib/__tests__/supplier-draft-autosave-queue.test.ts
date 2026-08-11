import { describe, expect, it } from "vitest"

import {
  createCoalescingSerialAsyncQueue,
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

  it("coalesces burst enqueues into one flush with the latest task", async () => {
    const q = createCoalescingSerialAsyncQueue()
    let runs = 0

    const slow = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 40))
      runs += 1
      return "slow"
    })
    const burstA = q.enqueue(async () => {
      runs += 10
      return "a"
    })
    const burstB = q.enqueue(async () => {
      runs += 100
      return "latest"
    })

    await expect(slow).resolves.toBe("slow")
    await expect(Promise.all([burstA, burstB])).resolves.toEqual(["latest", "latest"])
    expect(runs).toBe(101)
  })

  it("detects stale autosave generations", () => {
    expect(isLatestAutosaveGeneration(3, 3)).toBe(true)
    expect(isLatestAutosaveGeneration(2, 3)).toBe(false)
  })
})
