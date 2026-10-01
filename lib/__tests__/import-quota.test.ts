import { describe, expect, it, vi, beforeEach } from "vitest"

const { aggregateImportJob } = vi.hoisted(() => ({
  aggregateImportJob: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { importJob: { aggregate: aggregateImportJob } },
}))

import {
  assertImportQuotaAllowed,
  importQuotaCapForPlan,
  IMPORT_QUOTA_DEFAULT_PER_WEEK,
  IMPORT_QUOTA_LANCEUR_PER_WEEK,
} from "@/lib/growth/import-quota.server"

describe("Growth import weekly quota", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    aggregateImportJob.mockReset()
  })

  it("caps non-Lanceur at 50/week, Lanceur at 2000/week", () => {
    expect(importQuotaCapForPlan("none")).toBe(IMPORT_QUOTA_DEFAULT_PER_WEEK)
    expect(importQuotaCapForPlan("dominator")).toBe(IMPORT_QUOTA_DEFAULT_PER_WEEK)
    expect(importQuotaCapForPlan("lanceur")).toBe(IMPORT_QUOTA_LANCEUR_PER_WEEK)
  })

  it("allows a user under their weekly cap", async () => {
    aggregateImportJob.mockResolvedValue({ _sum: { importedCount: 10 } })
    const result = await assertImportQuotaAllowed("u1", "none")
    expect(result).toEqual({ allowed: true })
  })

  it("blocks once the weekly cap is reached", async () => {
    aggregateImportJob.mockResolvedValue({ _sum: { importedCount: 50 } })
    const result = await assertImportQuotaAllowed("u2", "none")
    expect(result).toEqual({ allowed: false, cap: 50, usedThisWeek: 50 })
  })

  it("treats rows with a null importedCount (pre-Phase-0 data) as zero, not a crash", async () => {
    aggregateImportJob.mockResolvedValue({ _sum: { importedCount: null } })
    const result = await assertImportQuotaAllowed("u3", "none")
    expect(result).toEqual({ allowed: true })
  })

  it("only queries the trailing 7-day window", async () => {
    aggregateImportJob.mockResolvedValue({ _sum: { importedCount: 0 } })
    await assertImportQuotaAllowed("u4", "lanceur")
    expect(aggregateImportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u4", createdAt: expect.objectContaining({ gte: expect.any(Date) }) }),
      })
    )
  })

  it("is bypassed entirely when GROWTH_IMPORT_QUOTA_PAUSED is set", async () => {
    vi.stubEnv("GROWTH_IMPORT_QUOTA_PAUSED", "1")
    const result = await assertImportQuotaAllowed("u5", "none")
    expect(result).toEqual({ allowed: true })
    expect(aggregateImportJob).not.toHaveBeenCalled()
  })
})
