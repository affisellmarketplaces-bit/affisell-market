import { describe, expect, it } from "vitest"

import { resolveAdminAgentAction } from "@/lib/agents/agent-application-shared"
import {
  canAgentSelfTransition,
} from "@/lib/agents/transition-agent-mission"

describe("canAgentSelfTransition", () => {
  it("allows start and complete flow", () => {
    expect(canAgentSelfTransition("ASSIGNED", "IN_PROGRESS")).toBe(true)
    expect(canAgentSelfTransition("IN_PROGRESS", "PASSED")).toBe(true)
    expect(canAgentSelfTransition("IN_PROGRESS", "FAILED")).toBe(true)
  })

  it("blocks admin-only transitions", () => {
    expect(canAgentSelfTransition("ASSIGNED", "PASSED")).toBe(false)
    expect(canAgentSelfTransition("REQUESTED", "IN_PROGRESS")).toBe(false)
  })
})

describe("activate provisions path", () => {
  it("activate from PENDING is valid", () => {
    expect(resolveAdminAgentAction("PENDING", "activate")).toBe("ACTIVE")
  })
})
