import { describe, expect, it } from "vitest"

import { AGENTS, PLATFORMS } from "@/lib/agents"

describe("AGENTS data integrity", () => {
  it("has unique ids", () => {
    const ids = AGENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("only references known platforms", () => {
    for (const agent of AGENTS) {
      for (const p of agent.platforms) {
        expect(PLATFORMS).toContain(p)
      }
    }
  })

  it("every platform has at least one agent", () => {
    for (const p of PLATFORMS) {
      expect(AGENTS.some((a) => a.platforms.includes(p))).toBe(true)
    }
  })

  it("Usines is only served by B2B-capable agents", () => {
    const factoryAgents = AGENTS.filter((a) => a.platforms.includes("Usines"))
    expect(factoryAgents.map((a) => a.id).sort()).toEqual(["anovabuy", "superbuy"])
    for (const a of factoryAgents) {
      expect(a.strengths).toContain("B2B")
    }
  })
})
