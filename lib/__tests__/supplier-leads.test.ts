import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  supplierLeadFindUniqueMock,
  supplierLeadCreateMock,
  supplierLeadUpdateMock,
  supplierLeadFindManyMock,
  supplierLeadGroupByMock,
  userFindUniqueMock,
  userUpdateMock,
  referralBonusLedgerFindUniqueMock,
  referralBonusLedgerCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  supplierLeadFindUniqueMock: vi.fn(),
  supplierLeadCreateMock: vi.fn(),
  supplierLeadUpdateMock: vi.fn(),
  supplierLeadFindManyMock: vi.fn(),
  supplierLeadGroupByMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
  referralBonusLedgerFindUniqueMock: vi.fn(),
  referralBonusLedgerCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplierLead: {
      findUnique: supplierLeadFindUniqueMock,
      create: supplierLeadCreateMock,
      update: supplierLeadUpdateMock,
      findMany: supplierLeadFindManyMock,
      groupBy: supplierLeadGroupByMock,
    },
    user: {
      findUnique: userFindUniqueMock,
      update: userUpdateMock,
    },
    referralBonusLedger: {
      findUnique: referralBonusLedgerFindUniqueMock,
      create: referralBonusLedgerCreateMock,
    },
    $transaction: transactionMock,
  },
}))

import {
  createLead,
  markConverted,
  SUPPLIER_LEAD_CONVERSION_BONUS_CENTS,
  updateLeadStatus,
} from "@/lib/supplier-leads"

const baseLead = {
  id: "lead_1",
  email: "founder@brand.com",
  domain: "brand.com",
  brand: "Brand Co",
  firstName: "Alex",
  linkedinUrl: null,
  status: "CONTACTED" as const,
  source: "shopify",
  contactedAt: new Date("2026-07-10T10:00:00.000Z"),
  repliedAt: null,
  demoAt: null,
  convertedAt: null,
  convertedUserId: null,
  notes: null,
}

describe("supplier-leads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        supplierLead: {
          findUnique: supplierLeadFindUniqueMock,
          update: supplierLeadUpdateMock,
        },
        user: { update: userUpdateMock },
        referralBonusLedger: {
          findUnique: referralBonusLedgerFindUniqueMock,
          create: referralBonusLedgerCreateMock,
        },
      })
    )
  })

  it("createLead persists normalized email", async () => {
    supplierLeadFindUniqueMock.mockResolvedValueOnce(null)
    supplierLeadCreateMock.mockResolvedValueOnce(baseLead)

    const lead = await createLead({
      email: "  Founder@Brand.com ",
      domain: "brand.com",
      brand: "Brand Co",
      firstName: "Alex",
      source: "shopify",
    })

    expect(lead.email).toBe("founder@brand.com")
    expect(supplierLeadCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "founder@brand.com", source: "shopify" }),
      })
    )
  })

  it("createLead returns existing on duplicate email", async () => {
    supplierLeadFindUniqueMock.mockResolvedValueOnce(baseLead)

    const lead = await createLead({
      email: "founder@brand.com",
      domain: "brand.com",
      brand: "Brand Co",
      source: "manual",
    })

    expect(lead.id).toBe("lead_1")
    expect(supplierLeadCreateMock).not.toHaveBeenCalled()
  })

  it("updateLeadStatus sets repliedAt on REPLIED", async () => {
    supplierLeadFindUniqueMock.mockResolvedValueOnce(baseLead)
    supplierLeadUpdateMock.mockResolvedValueOnce({
      ...baseLead,
      status: "REPLIED",
      repliedAt: new Date("2026-07-11T10:00:00.000Z"),
    })

    const lead = await updateLeadStatus("lead_1", "REPLIED", "Interested")
    expect(lead?.status).toBe("REPLIED")
    expect(supplierLeadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REPLIED",
          notes: "Interested",
          repliedAt: expect.any(Date),
        }),
      })
    )
  })

  it("markConverted links user and credits +100€ bonus idempotently", async () => {
    userFindUniqueMock.mockResolvedValueOnce({ id: "user_sup", role: "SUPPLIER" })
    supplierLeadFindUniqueMock.mockResolvedValueOnce(baseLead)
    supplierLeadUpdateMock.mockResolvedValueOnce({
      ...baseLead,
      status: "CONVERTED",
      convertedUserId: "user_sup",
      convertedAt: new Date("2026-07-12T10:00:00.000Z"),
    })
    referralBonusLedgerFindUniqueMock.mockResolvedValueOnce(null)
    userUpdateMock.mockResolvedValueOnce({})
    referralBonusLedgerCreateMock.mockResolvedValueOnce({})

    const result = await markConverted("lead_1", "user_sup")
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.bonusCents).toBe(SUPPLIER_LEAD_CONVERSION_BONUS_CENTS)
    expect(result.lead.convertedUserId).toBe("user_sup")
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user_sup" },
      data: { referralBonusBalanceCents: { increment: SUPPLIER_LEAD_CONVERSION_BONUS_CENTS } },
    })
    expect(referralBonusLedgerCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_sup",
          amountCents: 10_000,
          idempotencyKey: "supplier-lead:converted:lead_1",
        }),
      })
    )
  })

  it("markConverted skips duplicate bonus ledger", async () => {
    userFindUniqueMock.mockResolvedValueOnce({ id: "user_sup", role: "SUPPLIER" })
    supplierLeadFindUniqueMock.mockResolvedValueOnce({
      ...baseLead,
      status: "CONVERTED",
      convertedUserId: "user_sup",
    })
    supplierLeadUpdateMock.mockResolvedValueOnce({
      ...baseLead,
      status: "CONVERTED",
      convertedUserId: "user_sup",
    })
    referralBonusLedgerFindUniqueMock.mockResolvedValueOnce({ amountCents: 10_000 })

    const result = await markConverted("lead_1", "user_sup")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.duplicate).toBe(true)
    expect(userUpdateMock).not.toHaveBeenCalled()
    expect(referralBonusLedgerCreateMock).not.toHaveBeenCalled()
  })
})
