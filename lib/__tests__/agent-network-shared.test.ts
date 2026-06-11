import { describe, expect, it } from "vitest"

import {
  canSupplierCancelMission,
  canSupplierDeleteMission,
  canSupplierEditMission,
  canTransitionMission,
  guessSkuOriginCountry,
  isAgentMissionType,
  matchAgentsForMission,
  missionTypeDef,
  type AgentLite,
} from "@/lib/agents/agent-network-shared"

const agents: AgentLite[] = [
  {
    id: "cn-shenzhen",
    displayName: "Shenzhen QC",
    country: "CN",
    city: "Shenzhen",
    capabilities: ["QC_INSPECTION", "PHOTO_PROOF", "REPACK_EXPRESS"],
    ratingX10: 48,
    missionsDone: 320,
    leadTimeHours: 24,
  },
  {
    id: "tr-istanbul",
    displayName: "Istanbul Hub",
    country: "TR",
    city: "Istanbul",
    capabilities: ["QC_INSPECTION", "COMPLIANCE"],
    ratingX10: 46,
    missionsDone: 80,
    leadTimeHours: 48,
  },
  {
    id: "vn-hcmc",
    displayName: "HCMC Compliance",
    country: "VN",
    city: "Ho Chi Minh",
    capabilities: ["COMPLIANCE"],
    ratingX10: 50,
    missionsDone: 12,
    leadTimeHours: 72,
  },
]

describe("matchAgentsForMission", () => {
  it("filters by required capability", () => {
    const matched = matchAgentsForMission(agents, { missionType: "COMPLIANCE_CHECK" })
    expect(matched.map((m) => m.agent.id)).toEqual(
      expect.arrayContaining(["tr-istanbul", "vn-hcmc"])
    )
    expect(matched.some((m) => m.agent.id === "cn-shenzhen")).toBe(false)
  })

  it("prefers same-country agents for QC", () => {
    const matched = matchAgentsForMission(agents, {
      missionType: "QC_INSPECTION",
      preferredCountry: "CN",
    })
    expect(matched[0]?.agent.id).toBe("cn-shenzhen")
    expect(matched[0]?.sameCountry).toBe(true)
  })

  it("returns empty when nobody has the capability", () => {
    const matched = matchAgentsForMission(
      agents.filter((a) => a.id === "vn-hcmc"),
      { missionType: "REPACK_EXPRESS" }
    )
    expect(matched).toEqual([])
  })

  it("scores within 0–100", () => {
    for (const m of matchAgentsForMission(agents, {
      missionType: "QC_INSPECTION",
      preferredCountry: "CN",
    })) {
      expect(m.score).toBeGreaterThanOrEqual(0)
      expect(m.score).toBeLessThanOrEqual(100)
    }
  })
})

describe("mission workflow", () => {
  it("allows the happy path", () => {
    expect(canTransitionMission("REQUESTED", "ASSIGNED")).toBe(true)
    expect(canTransitionMission("ASSIGNED", "IN_PROGRESS")).toBe(true)
    expect(canTransitionMission("IN_PROGRESS", "PASSED")).toBe(true)
    expect(canTransitionMission("IN_PROGRESS", "FAILED")).toBe(true)
  })

  it("blocks invalid transitions", () => {
    expect(canTransitionMission("PASSED", "FAILED")).toBe(false)
    expect(canTransitionMission("REQUESTED", "PASSED")).toBe(false)
    expect(canTransitionMission("CANCELLED", "ASSIGNED")).toBe(false)
  })
})

describe("mission type defs", () => {
  it("exposes fee + sla per type", () => {
    expect(missionTypeDef("QC_INSPECTION").listPriceCents).toBe(1900)
    expect(missionTypeDef("PHOTO_PROOF").slaHours).toBe(24)
  })

  it("validates unknown types", () => {
    expect(isAgentMissionType("QC_INSPECTION")).toBe(true)
    expect(isAgentMissionType("HACK")).toBe(false)
  })
})

describe("guessSkuOriginCountry", () => {
  it("maps 1688 / AliExpress to CN", () => {
    expect(guessSkuOriginCountry({ importSource: "1688" })).toBe("CN")
    expect(
      guessSkuOriginCountry({ sourceUrl: "https://fr.aliexpress.com/item/1.html" })
    ).toBe("CN")
  })

  it("returns null when unknown", () => {
    expect(guessSkuOriginCountry({ importSource: "manual" })).toBeNull()
  })
})

describe("supplier mission permissions", () => {
  it("allows edit on REQUESTED and ASSIGNED", () => {
    expect(canSupplierEditMission("REQUESTED")).toBe(true)
    expect(canSupplierEditMission("ASSIGNED")).toBe(true)
    expect(canSupplierEditMission("IN_PROGRESS")).toBe(false)
  })

  it("allows cancel while open", () => {
    expect(canSupplierCancelMission("ASSIGNED")).toBe(true)
    expect(canSupplierCancelMission("PASSED")).toBe(false)
  })

  it("allows delete on terminal only", () => {
    expect(canSupplierDeleteMission("CANCELLED")).toBe(true)
    expect(canSupplierDeleteMission("ASSIGNED")).toBe(false)
  })
})
