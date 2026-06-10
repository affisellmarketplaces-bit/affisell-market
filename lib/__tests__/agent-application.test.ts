import { describe, expect, it } from "vitest"

import {
  normalizeAgentApplication,
  resolveAdminAgentAction,
  type AgentCapabilityOption,
} from "@/lib/agents/agent-application-shared"

const validPayload = {
  displayName: "Shenzhen QC Pro",
  contactEmail: "agent@test.com",
  country: "CN",
  city: "Shenzhen",
  capabilities: ["QC_INSPECTION", "PHOTO_PROOF"] as AgentCapabilityOption[],
  languages: ["zh", "en"],
  leadTimeHours: 24,
  applicationNote: "10 ans QC électronique",
}

describe("normalizeAgentApplication", () => {
  it("accepts valid payload", () => {
    const out = normalizeAgentApplication(validPayload)
    expect(out?.contactEmail).toBe("agent@test.com")
    expect(out?.capabilities).toEqual(["QC_INSPECTION", "PHOTO_PROOF"])
  })

  it("rejects invalid country", () => {
    expect(normalizeAgentApplication({ ...validPayload, country: "China" })).toBeNull()
  })

  it("rejects empty capabilities", () => {
    expect(normalizeAgentApplication({ ...validPayload, capabilities: [] })).toBeNull()
  })

  it("parses comma-separated languages string", () => {
    const out = normalizeAgentApplication({ ...validPayload, languages: "fr, en, zh" })
    expect(out?.languages).toEqual(["fr", "en", "zh"])
  })
})

describe("resolveAdminAgentAction", () => {
  it("activates pending applications", () => {
    expect(resolveAdminAgentAction("PENDING", "activate")).toBe("ACTIVE")
  })

  it("rejects pending only", () => {
    expect(resolveAdminAgentAction("PENDING", "reject")).toBe("REJECTED")
    expect(resolveAdminAgentAction("ACTIVE", "reject")).toBeNull()
  })

  it("pauses and resumes active agents", () => {
    expect(resolveAdminAgentAction("ACTIVE", "pause")).toBe("PAUSED")
    expect(resolveAdminAgentAction("PAUSED", "resume")).toBe("ACTIVE")
  })
})
