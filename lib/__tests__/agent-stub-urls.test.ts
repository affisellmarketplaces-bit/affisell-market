import { describe, expect, it } from "vitest"

import {
  allChinaBuyingAgentIds,
  getAgentStubCheckoutUrl,
} from "@/lib/china-buying/agent-stub-urls"
import { AGENTS } from "@/lib/agents"

const SAMPLE = "https://detail.1688.com/offer/123.html"

describe("getAgentStubCheckoutUrl", () => {
  it("covers every catalog agent", () => {
    for (const agent of AGENTS) {
      const url = getAgentStubCheckoutUrl(agent.id, SAMPLE)
      expect(url, agent.id).toMatch(/^https:\/\//)
      expect(url, agent.id).toContain(encodeURIComponent(SAMPLE))
    }
  })

  it("matches shared agent id list", () => {
    expect(allChinaBuyingAgentIds().length).toBe(6)
  })

  it("rejects invalid url", () => {
    expect(getAgentStubCheckoutUrl("superbuy", "not-a-url")).toBeNull()
  })
})
