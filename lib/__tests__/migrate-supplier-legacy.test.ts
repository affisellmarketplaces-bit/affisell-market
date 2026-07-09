import { describe, expect, it, vi } from "vitest"

import { migrateSupplierLegacyAcceptance } from "../../scripts/migrate-supplier-legacy-acceptance"

describe("migrateSupplierLegacyAcceptance", () => {
  it("migrates supplier missing LMS row", async () => {
    const db = {
      legalDocument: {
        findUnique: vi.fn().mockResolvedValue({ currentVersionId: "ver_supplier" }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "user_1",
            email: "s@test.com",
            createdAt: new Date("2026-01-01"),
            termsAcceptedAt: new Date("2026-01-02"),
          },
        ]),
      },
      legalAcceptance: {
        count: vi.fn().mockResolvedValue(0),
        upsert: vi.fn().mockResolvedValue({ id: "acc_1" }),
      },
    } as never

    const stats = await migrateSupplierLegacyAcceptance(db, {})
    expect(stats.migrated).toBe(1)
    expect(stats.alreadyOnLms).toBe(0)
  })
})
