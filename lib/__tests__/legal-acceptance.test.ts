import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, getCurrentVersionMock, getLegalDocumentMock, authMock } = vi.hoisted(() => ({
    prismaMock: {
    user: { update: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    legalAcceptance: { upsert: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    legalDocument: { findUnique: vi.fn() },
    order: { update: vi.fn() },
  },
  getCurrentVersionMock: vi.fn(),
  getLegalDocumentMock: vi.fn(),
  authMock: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: authMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/legal/lms-resolver", () => ({
  getCurrentVersion: getCurrentVersionMock,
  getLegalDocument: getLegalDocumentMock,
}))
vi.mock("@/lib/terms-logger", () => ({
  logTermsAcceptanceFromRequest: vi.fn(),
}))
vi.mock("@/lib/legal/terms-acceptance-cookie", () => ({
  setTermsOkCookie: vi.fn(),
}))
vi.mock("@/lib/business-log", () => ({ logBusiness: vi.fn() }))

import { POST as cguAcceptancePOST } from "@/app/api/user/cgu-acceptance/route"
import { attachOrderCgvAcceptance, isDocumentAccepted } from "@/lib/legal/acceptance"
import { backfillLegalAcceptances } from "../../scripts/legal-backfill-acceptances"

const frVersion = {
  id: "ver_cgu_fr",
  version: "1.0.0",
  language: "fr",
  document: { id: "doc_cgu", category: "agreement", requiresAccept: true },
}

describe("legal acceptance dual-write", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentVersionMock.mockResolvedValue(frVersion)
    prismaMock.legalAcceptance.upsert.mockResolvedValue({
      id: "acc_1",
      documentVersionId: "ver_cgu_fr",
      acceptedAt: new Date("2026-07-09T12:00:00.000Z"),
    })
  })

  it("POST /api/user/cgu-acceptance creates LegalAcceptance and updates User", async () => {
    authMock.mockResolvedValue({
      user: { id: "user_1", role: "CUSTOMER" },
    })
    prismaMock.user.update.mockResolvedValue({
      id: "user_1",
      cguVersion: "2026-06-01",
      cguAcceptedAt: new Date("2026-07-09T12:00:00.000Z"),
    })

    const req = new Request("http://localhost/api/user/cgu-acceptance", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vitest" },
      body: JSON.stringify({ acceptCgu: true, acceptPrivacy: true }),
    })

    const res = await cguAcceptancePOST(req)
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalled()
    expect(prismaMock.legalAcceptance.upsert).toHaveBeenCalled()
    const keys = prismaMock.legalAcceptance.upsert.mock.calls.map(
      (call) => call[0].where.idempotencyKey
    )
    expect(keys).toContain("user:user_1:customer:1.0.0")
    expect(keys).toContain("user:user_1:privacy:1.0.0")
  })

  it("attachOrderCgvAcceptance sets Order.cgvVersionId on checkout fulfill", async () => {
    getCurrentVersionMock.mockResolvedValue({
      id: "ver_cgv_fr",
      version: "1.0.0",
      language: "fr",
      document: { id: "doc_cgv" },
    })
    prismaMock.legalAcceptance.upsert.mockResolvedValue({
      id: "acc_cgv",
      documentVersionId: "ver_cgv_fr",
      acceptedAt: new Date("2026-07-09T13:00:00.000Z"),
    })

    const tx = {
      legalAcceptance: { upsert: prismaMock.legalAcceptance.upsert },
      order: { update: prismaMock.order.update },
    }

    await attachOrderCgvAcceptance(tx as never, {
      orderId: "order_1",
      userId: "user_1",
      buyerEmail: "buyer@example.com",
      locale: "fr",
    })

    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: {
        cgvVersionId: "ver_cgv_fr",
        cgvAcceptedAt: new Date("2026-07-09T13:00:00.000Z"),
      },
    })
  })

  it("isDocumentAccepted returns false for stale version and true for current", async () => {
    getLegalDocumentMock.mockResolvedValue({
      id: "doc_cgu",
      currentVersionId: "ver_current",
    })

    prismaMock.legalAcceptance.findFirst
      .mockResolvedValueOnce({ documentVersionId: "ver_old" })
      .mockResolvedValueOnce({ documentVersionId: "ver_current" })

    await expect(isDocumentAccepted("user_1", "customer")).resolves.toBe(false)
    await expect(isDocumentAccepted("user_1", "customer")).resolves.toBe(true)
  })

  it("isDocumentAccepted ignores legacy User consent fields without LMS row", async () => {
    getLegalDocumentMock.mockResolvedValue({
      id: "doc_cgu",
      currentVersionId: "ver_current",
    })
    prismaMock.legalAcceptance.findFirst.mockResolvedValue(null)

    await expect(isDocumentAccepted("legacy_user", "customer")).resolves.toBe(false)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("backfill creates LegalAcceptance with migrate idempotencyKey", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user_99",
        cguAcceptedAt: new Date("2026-01-01"),
        privacyAcceptedAt: null,
        termsAcceptedAt: null,
        termsAcceptedVersion: null,
      },
    ])
    prismaMock.legalDocument.findUnique.mockResolvedValue({
      currentVersionId: "ver_cgu_fr",
    })

    const stats = await backfillLegalAcceptances(prismaMock as never)
    expect(stats.usersScanned).toBe(1)
    expect(stats.acceptancesCreated).toBe(1)
    expect(prismaMock.legalAcceptance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: "migrate:cgu:user_99" },
      })
    )
  })
})
