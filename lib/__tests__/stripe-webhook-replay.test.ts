import { describe, expect, it } from "vitest"

import { isDuplicateWebhookRecord, isReplayableWebhookRecord } from "@/lib/stripe-webhook-replay"

describe("stripe webhook replay rule", () => {
  it("only a failed record is replayable", () => {
    expect(isReplayableWebhookRecord({ status: "failed" })).toBe(true)
    for (const status of ["success", "skipped", "processing", "FAILED", ""]) {
      expect(isReplayableWebhookRecord({ status })).toBe(false)
    }
    expect(isReplayableWebhookRecord(null)).toBe(false)
    expect(isReplayableWebhookRecord(undefined)).toBe(false)
  })

  it("every other recorded status is a duplicate; no record is not a duplicate", () => {
    expect(isDuplicateWebhookRecord({ status: "failed" })).toBe(false)
    for (const status of ["success", "skipped", "processing"]) {
      expect(isDuplicateWebhookRecord({ status })).toBe(true)
    }
    expect(isDuplicateWebhookRecord(null)).toBe(false)
    expect(isDuplicateWebhookRecord(undefined)).toBe(false)
  })
})
