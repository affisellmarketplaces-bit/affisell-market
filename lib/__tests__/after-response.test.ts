import { beforeEach, describe, expect, it, vi } from "vitest"

const { afterMock } = vi.hoisted(() => ({ afterMock: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: afterMock }))

import { runAfterResponse } from "@/lib/after-response"

describe("runAfterResponse", () => {
  beforeEach(() => {
    afterMock.mockReset()
  })

  it("defers the task to after the response and does not run it inline", async () => {
    afterMock.mockImplementation(() => undefined)
    const task = vi.fn().mockResolvedValue(undefined)
    await runAfterResponse("t", task)
    expect(afterMock).toHaveBeenCalledTimes(1)
    expect(task).not.toHaveBeenCalled()
  })

  it("contains errors of the deferred task", async () => {
    afterMock.mockImplementation((fn: () => Promise<void>) => fn())
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await expect(runAfterResponse("boom", async () => { throw new Error("x") })).resolves.toBeUndefined()
    spy.mockRestore()
  })

  it("runs inline and awaits when there is no request scope (cron, scripts)", async () => {
    afterMock.mockImplementation(() => { throw new Error("outside request scope") })
    let done = false
    await runAfterResponse("inline", async () => { await Promise.resolve(); done = true })
    expect(done).toBe(true)
  })
})
