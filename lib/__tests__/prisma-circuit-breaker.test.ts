import { describe, expect, it, vi, afterEach } from "vitest"

import {
  clearPrismaCircuit,
  isPrismaCircuitOpen,
  notePrismaUnreachable,
} from "@/lib/prisma-circuit-breaker"

describe("prisma-circuit-breaker", () => {
  afterEach(() => {
    clearPrismaCircuit()
    vi.useRealTimers()
  })

  it("opens circuit on P1001 and closes after cooldown", () => {
    notePrismaUnreachable({ code: "P1001", message: "Can't reach database server" })
    expect(isPrismaCircuitOpen()).toBe(true)

    vi.useFakeTimers()
    vi.advanceTimersByTime(8_001)
    expect(isPrismaCircuitOpen()).toBe(false)
  })

  it("ignores non-connection errors", () => {
    notePrismaUnreachable({ code: "P2002", message: "Unique constraint failed" })
    expect(isPrismaCircuitOpen()).toBe(false)
  })
})
