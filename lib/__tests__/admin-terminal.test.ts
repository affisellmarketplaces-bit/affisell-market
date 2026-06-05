import { describe, expect, it } from "vitest"

import { parseReturnsStatusFilter } from "@/lib/admin/returns/load-returns-queue"
import { parseSupportStatusFilter } from "@/lib/admin/support/load-support-queue"
import { isSupportTicketStatus } from "@/lib/admin/support-ticket-shared"

describe("admin-terminal", () => {
  it("parses support status filter safely", () => {
    expect(parseSupportStatusFilter(null)).toBe("active")
    expect(parseSupportStatusFilter("OPEN")).toBe("OPEN")
    expect(parseSupportStatusFilter("bogus")).toBe("active")
  })

  it("validates support ticket statuses", () => {
    expect(isSupportTicketStatus("RESOLVED")).toBe(true)
    expect(isSupportTicketStatus("CLOSED")).toBe(false)
  })

  it("parses returns status filter safely", () => {
    expect(parseReturnsStatusFilter(null)).toBe("active")
    expect(parseReturnsStatusFilter("REQUESTED")).toBe("REQUESTED")
    expect(parseReturnsStatusFilter("bogus")).toBe("active")
  })
})
