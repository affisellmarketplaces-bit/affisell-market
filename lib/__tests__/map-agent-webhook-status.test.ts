import { describe, expect, it } from "vitest"

import { mapChinaBuyWebhookStatus } from "@/lib/china-buying/map-agent-webhook-status"

describe("mapChinaBuyWebhookStatus", () => {
  it("maps processing to ROUTED", () => {
    expect(mapChinaBuyWebhookStatus("processing")).toBe("ROUTED")
  })

  it("maps purchased to API_OK", () => {
    expect(mapChinaBuyWebhookStatus("purchased")).toBe("API_OK")
  })

  it("maps cancelled to API_FAIL", () => {
    expect(mapChinaBuyWebhookStatus("cancelled")).toBe("API_FAIL")
  })

  it("returns null for unknown status", () => {
    expect(mapChinaBuyWebhookStatus("???")).toBeNull()
  })
})
