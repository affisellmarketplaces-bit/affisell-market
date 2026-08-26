import { describe, expect, it } from "vitest"

import { auditFulfillmentPoolerConfig } from "@/lib/ai-engineer/pooler-audit"
import { filterRelevantLogLines } from "@/lib/ai-engineer/log-sources"

describe("ing observer patterns", () => {
  it("detects manual_required in log lines", () => {
    const lines = filterRelevantLogLines([
      '[fulfillment-orchestrator] manual_required {"groupId":"g1"}',
      "noise line",
    ])
    expect(lines.some((l) => l.includes("manual_required"))).toBe(true)
  })

  it("detects Engine was empty in log lines", () => {
    const lines = filterRelevantLogLines(['[prisma] Engine was empty on connection'])
    expect(lines.length).toBe(1)
  })

  it("audits pooler strip in ensure-database-url-unpooled", () => {
    const audit = auditFulfillmentPoolerConfig()
    expect(audit.poolerStripPresent).toBe(true)
  })
})
