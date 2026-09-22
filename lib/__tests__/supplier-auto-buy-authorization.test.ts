import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUniqueMock, findManyMock, upsertMock, updateManyMock, userFindUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
  upsertMock: vi.fn(),
  updateManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplierAutoBuyAuthorization: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
      upsert: upsertMock,
      updateMany: updateManyMock,
    },
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}))

import {
  channelRequiresAuthorization,
  isSupplierAuthorizedForChannel,
  listAuthorizedChannelsForSupplier,
  setSupplierAutoBuyAuthorization,
} from "@/lib/supplier-auto-buy-authorization.server"

describe("supplier-auto-buy-authorization", () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    findManyMock.mockReset()
    upsertMock.mockReset()
    updateManyMock.mockReset()
    userFindUniqueMock.mockReset()
  })

  it("never requires authorization for non-sourcing channels", () => {
    expect(channelRequiresAuthorization("AFFISELL_NATIVE")).toBe(false)
    expect(channelRequiresAuthorization("BLIND_REST")).toBe(false)
    expect(channelRequiresAuthorization("MANUAL")).toBe(false)
  })

  it("requires authorization for sourcing channels", () => {
    expect(channelRequiresAuthorization("ALIEXPRESS")).toBe(true)
    expect(channelRequiresAuthorization("CJ_DROPSHIPPING")).toBe(true)
  })

  it("non-sourcing channels are always authorized — no DB lookup", async () => {
    await expect(isSupplierAuthorizedForChannel("sup_1", "AFFISELL_NATIVE")).resolves.toBe(true)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it("blocks a sourcing channel with no grant row", async () => {
    findUniqueMock.mockResolvedValue(null)
    await expect(isSupplierAuthorizedForChannel("sup_1", "ALIEXPRESS")).resolves.toBe(false)
  })

  it("blocks a revoked grant", async () => {
    findUniqueMock.mockResolvedValue({ revokedAt: new Date("2026-01-01") })
    await expect(isSupplierAuthorizedForChannel("sup_1", "ALIEXPRESS")).resolves.toBe(false)
  })

  it("allows an active grant", async () => {
    findUniqueMock.mockResolvedValue({ revokedAt: null })
    await expect(isSupplierAuthorizedForChannel("sup_1", "ALIEXPRESS")).resolves.toBe(true)
  })

  it("rejects granting a non-sourcing channel — nothing to authorize there", async () => {
    const result = await setSupplierAutoBuyAuthorization({
      supplierId: "sup_1",
      channelType: "AFFISELL_NATIVE",
      enabled: true,
      adminUserId: "admin_1",
    })
    expect(result).toEqual({ ok: false, error: "not_a_sourcing_channel" })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("rejects granting a supplier that doesn't exist or isn't a SUPPLIER", async () => {
    userFindUniqueMock.mockResolvedValue(null)
    const result = await setSupplierAutoBuyAuthorization({
      supplierId: "sup_missing",
      channelType: "ALIEXPRESS",
      enabled: true,
      adminUserId: "admin_1",
    })
    expect(result).toEqual({ ok: false, error: "supplier_not_found" })
  })

  it("grants via upsert, revokes via updateMany", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "sup_1", role: "SUPPLIER" })

    await setSupplierAutoBuyAuthorization({
      supplierId: "sup_1",
      channelType: "ALIEXPRESS",
      enabled: true,
      adminUserId: "admin_1",
    })
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(updateManyMock).not.toHaveBeenCalled()

    await setSupplierAutoBuyAuthorization({
      supplierId: "sup_1",
      channelType: "ALIEXPRESS",
      enabled: false,
      adminUserId: "admin_1",
    })
    expect(updateManyMock).toHaveBeenCalledTimes(1)
  })

  it("lists only active channels", async () => {
    findManyMock.mockResolvedValue([{ channelType: "ALIEXPRESS" }, { channelType: "BIGBUY" }])
    await expect(listAuthorizedChannelsForSupplier("sup_1")).resolves.toEqual(["ALIEXPRESS", "BIGBUY"])
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supplierId: "sup_1", revokedAt: null } })
    )
  })
})
